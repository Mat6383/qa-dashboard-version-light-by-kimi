import integrationService from '../services/integration.service';

// Mock global.fetch for Jira / webhook tests
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('IntegrationService', () => {
  beforeAll(() => {
    integrationService.init();
  });

  beforeEach(() => {
    integrationService.db.prepare('DELETE FROM integrations').run();
    mockFetch.mockClear();
  });

  test('create et getById', () => {
    const created = integrationService.create({
      name: 'Jira Prod',
      type: 'jira',
      config: { baseUrl: 'https://jira.example.com', apiToken: 'tok' },
      enabled: true,
    });
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Jira Prod');

    const fetched = integrationService.getById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.config.baseUrl).toBe('https://jira.example.com');
  });

  test('list retourne toutes les intégrations', () => {
    integrationService.create({ name: 'A', type: 'generic_webhook', config: { url: 'http://a' } });
    integrationService.create({ name: 'B', type: 'jira', config: {} });
    const list = integrationService.list();
    expect(list.length).toBe(2);
  });

  test('update modifie une intégration', () => {
    const created = integrationService.create({ name: 'Old', type: 'jira', config: {} });
    const updated = integrationService.update(created.id, { name: 'New', enabled: false });
    expect(updated!.name).toBe('New');
    expect(updated!.enabled).toBe(false);
  });

  test('delete supprime une intégration', () => {
    const created = integrationService.create({ name: 'X', type: 'jira', config: {} });
    integrationService.delete(created.id);
    expect(integrationService.getById(created.id)).toBeNull();
  });

  test('testJiraConnection échoue sans credentials', async () => {
    const result = await integrationService.testJiraConnection({});
    expect(result.success).toBe(false);
  });

  test('sendWebhook échoue sans URL', async () => {
    const result = await integrationService.sendWebhook({}, { event: 'test' });
    expect(result.success).toBe(false);
  });

  test('create avec type gitlab', () => {
    const created = integrationService.create({
      name: 'GitLab Staging',
      type: 'gitlab',
      config: { baseUrl: 'https://gitlab.example.com', token: 'glpat-xxx' },
      enabled: true,
    });
    expect(created.id).toBeDefined();
    expect(created.type).toBe('gitlab');
  });

  test('testGitLabConnection échoue sans credentials', async () => {
    const result = await integrationService.testGitLabConnection({});
    expect(result.success).toBe(false);
  });

  // ── createJiraIssue ───────────────────────────────────────────

  test('createJiraIssue crée un ticket avec succès', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'PROJ-123' }),
    });

    const result = await integrationService.createJiraIssue(
      { baseUrl: 'https://jira.example.com', username: 'user', apiToken: 'tok', projectKey: 'PROJ' },
      { summary: 'Bug found', description: 'Details here', issueType: 'Bug' }
    );

    expect(result.success).toBe(true);
    expect(result.key).toBe('PROJ-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://jira.example.com/rest/api/2/issue',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Basic '),
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('Bug found'),
      })
    );
  });

  test('createJiraIssue échoue si credentials manquants', async () => {
    const result = await integrationService.createJiraIssue(
      { baseUrl: '', apiToken: '', projectKey: '' },
      { summary: 'Bug', description: '' }
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('baseUrl, token et projectKey requis');
  });

  test('createJiraIssue gère une erreur HTTP Jira', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    const result = await integrationService.createJiraIssue(
      { baseUrl: 'https://jira.example.com', apiToken: 'tok', projectKey: 'PROJ' },
      { summary: 'Bug', description: '' }
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Jira HTTP 400');
  });

  test('createJiraIssue gère une erreur réseau', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await integrationService.createJiraIssue(
      { baseUrl: 'https://jira.example.com', apiToken: 'tok', projectKey: 'PROJ' },
      { summary: 'Bug', description: '' }
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Network error');
  });

  // ── testJiraConnection ────────────────────────────────────────

  test('testJiraConnection réussit', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await integrationService.testJiraConnection({
      baseUrl: 'https://jira.example.com',
      username: 'user',
      apiToken: 'tok',
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://jira.example.com/rest/api/2/myself',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.stringContaining('Basic ') }),
      })
    );
  });

  test('testJiraConnection échoue sur HTTP 401', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await integrationService.testJiraConnection({
      baseUrl: 'https://jira.example.com',
      apiToken: 'tok',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Jira HTTP 401');
  });

  test('testJiraConnection gère une erreur réseau', async () => {
    mockFetch.mockRejectedValue(new Error('Timeout'));

    const result = await integrationService.testJiraConnection({
      baseUrl: 'https://jira.example.com',
      apiToken: 'tok',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Timeout');
  });

  // ── sendWebhook ───────────────────────────────────────────────

  test('sendWebhook envoie sans secret', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await integrationService.sendWebhook(
      { url: 'https://hook.example.com' },
      { event: 'test', value: 42 }
    );

    expect(result.success).toBe(true);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).not.toHaveProperty('X-Webhook-Signature');
  });

  test('sendWebhook envoie avec signature HMAC si secret fourni', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await integrationService.sendWebhook(
      { url: 'https://hook.example.com', secret: 'shh' },
      { event: 'test' }
    );

    expect(result.success).toBe(true);
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(init.body).toBe(JSON.stringify({ event: 'test' }));
  });

  test('sendWebhook gère une erreur HTTP', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await integrationService.sendWebhook(
      { url: 'https://hook.example.com' },
      {}
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Webhook HTTP 500');
  });

  test('sendWebhook gère une erreur réseau', async () => {
    mockFetch.mockRejectedValue(new Error('DNS failure'));

    const result = await integrationService.sendWebhook(
      { url: 'https://hook.example.com' },
      {}
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('DNS failure');
  });
});
