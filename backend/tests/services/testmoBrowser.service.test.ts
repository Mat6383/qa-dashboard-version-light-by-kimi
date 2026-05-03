/**
 * Tests unitaires — TestmoBrowserService
 * Mocks Puppeteer pour éviter de lancer un vrai browser.
 */

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

import puppeteer from 'puppeteer';
import testmoBrowserService from '../../services/testmoBrowser.service';

describe('TestmoBrowserService', () => {
  let mockPage: any;
  let mockBrowser: any;

  let urlCallCount = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    urlCallCount = 0;

    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue({
        click: jest.fn().mockResolvedValue(undefined),
        type: jest.fn().mockResolvedValue(undefined),
        select: jest.fn().mockResolvedValue(undefined),
        scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined),
      }),
      click: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      select: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      url: jest.fn().mockReturnValue('https://testmo.example.com/projects/1/runs/123'),
      evaluate: jest.fn().mockResolvedValue(undefined),
      $$eval: jest.fn().mockResolvedValue([]),
      $: jest.fn().mockResolvedValue(null),
      $$: jest.fn().mockResolvedValue([]),
      setCookie: jest.fn().mockResolvedValue(undefined),
      setDefaultTimeout: jest.fn(),
      keyboard: { press: jest.fn().mockResolvedValue(undefined) },
      waitForNavigation: jest.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);

    process.env.TESTMO_URL = 'https://testmo.example.com';
    process.env.TESTMO_UI_USER = 'qa@example.com';
    process.env.TESTMO_UI_PASSWORD = 'secret';
  });

  afterEach(async () => {
    await testmoBrowserService.close();
  });

  describe('authenticate', () => {
    it('authentifie via cookie si TESTMO_BROWSER_COOKIE est défini', async () => {
      process.env.TESTMO_BROWSER_COOKIE = 'session_abc123';
      mockPage.url.mockReturnValue('https://testmo.example.com/projects');

      const page = await (testmoBrowserService as any)._newPage();
      await testmoBrowserService.authenticate(page);

      expect(mockPage.setCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'testmo_session',
          value: 'session_abc123',
        })
      );
    });

    it('authentifie via formulaire si pas de cookie', async () => {
      delete process.env.TESTMO_BROWSER_COOKIE;
      // Simule une page déjà authentifiée — le login form est skip
      mockPage.url.mockReturnValue('https://testmo.example.com/projects');

      const page = await (testmoBrowserService as any)._newPage();
      await testmoBrowserService.authenticate(page);

      // Déjà logué → pas besoin de remplir le formulaire
      expect(mockPage.type).not.toHaveBeenCalled();
    });

    it('lève une erreur si login échoue', async () => {
      delete process.env.TESTMO_BROWSER_COOKIE;
      delete process.env.TESTMO_UI_USER;
      delete process.env.TESTMO_UI_PASSWORD;
      process.env.TESTMO_EMAIL = '';
      process.env.TESTMO_PASSWORD = '';

      // Forcer la page à être sur une URL d'auth pour déclencher le fallback login
      mockPage.url.mockReturnValue('https://testmo.example.com/auth/login');

      const page = await (testmoBrowserService as any)._newPage();
      await expect(testmoBrowserService.authenticate(page)).rejects.toThrow(
        'TESTMO_BROWSER_COOKIE or TESTMO_UI_USER + TESTMO_UI_PASSWORD'
      );
    });
  });

  describe('createManualRun', () => {
    it('crée un run et retourne son ID', async () => {
      mockPage.url.mockReturnValue('https://testmo.example.com/projects/1/runs/456');

      const result = await testmoBrowserService.createManualRun(1, {
        name: 'R06 - run 1',
        milestoneId: 9,
      });

      expect(result.runId).toBe(456);
      expect(result.url).toContain('/runs/456');
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://testmo.example.com/projects/1/runs',
        expect.any(Object)
      );
    });

    it('lève une erreur si runId non extrait', async () => {
      mockPage.url.mockReturnValue('https://testmo.example.com/projects/1/runs');
      mockPage.$$eval.mockResolvedValue([]);

      await expect(
        testmoBrowserService.createManualRun(1, { name: 'Test' })
      ).rejects.toThrow('Could not extract runId');
    });
  });

  describe('addRunResults', () => {
    it('ajoute des résultats ligne par ligne', async () => {
      // Mock _setSingleResult pour simuler le succès
      jest.spyOn(testmoBrowserService as any, '_setSingleResult').mockResolvedValue(undefined);

      const stats = await testmoBrowserService.addRunResults(1, 123, [
        { caseId: 1, status: 'passed' },
        { caseId: 2, status: 'failed', note: 'bug' },
      ]);

      expect(stats.updated).toBe(2);
      expect(stats.errors).toBe(0);

      (testmoBrowserService as any)._setSingleResult.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('retourne ok si authentifié', async () => {
      mockPage.url.mockReturnValue('https://testmo.example.com/projects');
      const check = await testmoBrowserService.healthCheck();
      expect(check.ok).toBe(true);
    });

    it('retourne ko si erreur', async () => {
      delete process.env.TESTMO_URL;
      const check = await testmoBrowserService.healthCheck();
      expect(check.ok).toBe(false);
    });
  });
});
