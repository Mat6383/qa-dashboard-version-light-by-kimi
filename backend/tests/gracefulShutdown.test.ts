import { setup } from '../bootstrap/gracefulShutdown';

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../services/syncHistory.service', () => ({
  __esModule: true,
  default: {
    db: { close: jest.fn() },
  },
}));

jest.mock('../services/comments.service', () => ({
  __esModule: true,
  default: {
    db: { close: jest.fn() },
  },
}));

describe('gracefulShutdown', () => {
  let exitSpy: jest.SpyInstance;
  let onSpy: jest.SpyInstance;
  let handlers: Record<string, Function> = {};

  beforeEach(() => {
    handlers = {};
    jest.clearAllMocks();
    jest.spyOn(global, 'setTimeout').mockImplementation(() => 999 as any);
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    onSpy = jest.spyOn(process, 'on').mockImplementation((event: string | symbol, handler: any) => {
      if (typeof event === 'string') handlers[event] = handler;
      return process;
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    onSpy.mockRestore();
  });

  test('enregistre les handlers SIGTERM et SIGINT', () => {
    const server = { close: jest.fn() };
    setup(server);
    expect(handlers['SIGTERM']).toBeDefined();
    expect(handlers['SIGINT']).toBeDefined();
  });

  test('SIGTERM ferme le serveur et les DB', () => {
    const server = { close: jest.fn((cb) => cb()) };
    setup(server);
    handlers['SIGTERM']();

    expect(server.close).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('SIGINT ferme le serveur et les DB', () => {
    const server = { close: jest.fn((cb) => cb()) };
    setup(server);
    handlers['SIGINT']();

    expect(server.close).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test('gère une erreur de fermeture DB', () => {
    const syncHistory = require('../services/syncHistory.service').default;
    syncHistory.db.close.mockImplementation(() => { throw new Error('DB busy'); });

    const server = { close: jest.fn((cb) => cb()) };
    setup(server);
    handlers['SIGTERM']();

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

});
