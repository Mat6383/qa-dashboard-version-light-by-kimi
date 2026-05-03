const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
}));

jest.mock('nodemailer', () => ({
  createTransport: (...args: any[]) => mockCreateTransport(...args),
}));

jest.mock('../i18n', () => ({
  t: jest.fn((key: string, opts?: any) => {
    const map: Record<string, string> = {
      'email.slaAlertSubject': 'Alerte SLA - {{projectName}}',
      'email.slaAlertTitle': 'Alerte SLA',
      'email.slaAlertText': 'Alerte pour {{projectName}}',
      'email.severity': 'Sévérité',
      'email.metric': 'Métrique',
      'email.value': 'Valeur',
      'email.threshold': 'Seuil',
      'email.viewDashboard': 'Voir le dashboard',
    };
    return map[key] || key;
  }),
}));

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('EmailService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  function getService() {
    jest.resetModules();
    return require('../services/email.service').default;
  }

  describe('avec configuration SMTP complète', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      process.env.SMTP_FROM = 'qa@example.com';
    });

    test('sendSLAAlert envoie un email', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg-123>' });
      const service = getService();

      const result = await service.sendSLAAlert({
        to: 'alert@example.com',
        projectId: 1,
        projectName: 'Alpha',
        alerts: [{ severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85 }],
        dashboardUrl: 'http://dash.example.com',
      });

      expect(result.sent).toBe(true);
      expect(result.messageId).toBe('<msg-123>');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'qa@example.com',
          to: 'alert@example.com',
          subject: 'Alerte SLA - Alpha',
          html: expect.stringContaining('Alpha'),
          text: expect.stringContaining('Alpha'),
        })
      );
    });

    test('sendSLAAlert utilise customHtml et customText si fournis', async () => {
      mockSendMail.mockResolvedValue({ messageId: '<msg-456>' });
      const service = getService();

      const result = await service.sendSLAAlert({
        to: 'alert@example.com',
        projectId: 1,
        projectName: 'Alpha',
        alerts: [],
        customHtml: '<b>Custom HTML</b>',
        customText: 'Custom Text',
      });

      expect(result.sent).toBe(true);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toBe('<b>Custom HTML</b>');
      expect(call.text).toBe('Custom Text');
    });

    test('sendSLAAlert retourne not_configured si pas de destinataire', async () => {
      const service = getService();
      const result = await service.sendSLAAlert({
        to: '',
        projectId: 1,
        projectName: 'Alpha',
        alerts: [],
      });
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('not_configured');
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test('sendSLAAlert gère l échec d envoi', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP timeout'));
      const service = getService();

      const result = await service.sendSLAAlert({
        to: 'alert@example.com',
        projectId: 1,
        projectName: 'Alpha',
        alerts: [],
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('SMTP timeout');
    });

    test('_buildHTML génère un tableau d alertes', () => {
      const service = getService();
      const html = service._buildHTML({
        projectId: 1,
        projectName: 'Beta',
        alerts: [
          { severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85 },
          { severity: 'warning', metric: 'Blocked Rate', value: 12, threshold: 10 },
        ],
        dashboardUrl: 'http://dash.example.com',
        lang: 'fr',
      });

      expect(html).toContain('Beta');
      expect(html).toContain('Pass Rate');
      expect(html).toContain('Blocked Rate');
      expect(html).toContain('http://dash.example.com');
      expect(html).toContain('#DC2626'); // critical color
      expect(html).toContain('#F59E0B'); // warning color
    });

    test('_buildText génère un texte plat', () => {
      const service = getService();
      const text = service._buildText({
        projectId: 1,
        projectName: 'Gamma',
        alerts: [{ severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85 }],
        dashboardUrl: 'http://dash.example.com',
        lang: 'fr',
      });

      expect(text).toContain('Gamma');
      expect(text).toContain('CRITICAL');
      expect(text).toContain('http://dash.example.com');
    });

    test('le constructeur crée le transporter en mode secure si port 465', () => {
      process.env.SMTP_PORT = '465';
      getService();
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true, port: 465 })
      );
    });
  });

  describe('sans configuration SMTP', () => {
    beforeEach(() => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
    });

    test('sendSLAAlert retourne not_configured', async () => {
      const service = getService();
      const result = await service.sendSLAAlert({
        to: 'alert@example.com',
        projectId: 1,
        projectName: 'Alpha',
        alerts: [],
      });
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('not_configured');
    });

    test('le constructeur loggue un warning', () => {
      getService();
      const logger = require('../services/logger.service');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SMTP incomplète')
      );
    });
  });
});
