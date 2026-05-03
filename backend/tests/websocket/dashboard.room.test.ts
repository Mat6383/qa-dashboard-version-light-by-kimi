/**
 * Tests unitaires du DashboardRoom (WebSocket)
 */

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../services/testmo.service', () => ({
  getProjectMetrics: jest.fn().mockResolvedValue({ passRate: 80 }),
  getEscapeAndDetectionRates: jest.fn().mockResolvedValue({ escapeRate: 2 }),
}));

import { DashboardRoom } from '../../websocket/dashboard.room';

const createMockWS = () => ({
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  on: jest.fn(),
});

describe('DashboardRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('démarre le polling quand le premier client arrive', () => {
    const room = new DashboardRoom(1);
    const ws = createMockWS();
    room.addClient(ws as any);
    expect((room as any).interval).toBeTruthy();
  });

  it('arrête le polling quand le dernier client part', () => {
    const room = new DashboardRoom(1);
    const ws = createMockWS();
    room.addClient(ws as any);
    room.removeClient(ws as any);
    expect((room as any).interval).toBeNull();
  });

  it('broadcast uniquement si le hash change', async () => {
    const room = new DashboardRoom(1);
    const ws1 = createMockWS();
    const ws2 = createMockWS();
    room.addClient(ws1 as any);
    room.addClient(ws2 as any);

    // Attendre que le fetchAndBroadcast initial (appelé par startPolling) se résolve
    await Promise.resolve();
    await Promise.resolve();

    // Premier broadcast → les 2 clients reçoivent
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();

    const callCountBefore = ws1.send.mock.calls.length;

    jest.advanceTimersByTime(30000);
    await Promise.resolve();
    await Promise.resolve();

    // Hash inchangé (même timestamp mocké) → pas de nouveau broadcast
    expect(ws1.send.mock.calls.length).toBe(callCountBefore);
  });

  it('gère plusieurs projectId indépendamment', () => {
    const room1 = new DashboardRoom(1);
    const room2 = new DashboardRoom(2);
    room1.addClient(createMockWS() as any);
    room2.addClient(createMockWS() as any);
    expect((room1 as any).interval).toBeTruthy();
    expect((room2 as any).interval).toBeTruthy();
  });
});
