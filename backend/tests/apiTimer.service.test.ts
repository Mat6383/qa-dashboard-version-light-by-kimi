import { instrumentAxios, getStats } from '../services/apiTimer.service';
/**
 * Tests unitaires — ApiTimer Service
 */


describe('ApiTimer Service', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
  });

  it('instruments axios client with request and response interceptors', () => {
    instrumentAxios(mockClient, 'test-api');
    expect(mockClient.interceptors.request.use).toHaveBeenCalledTimes(1);
    expect(mockClient.interceptors.response.use).toHaveBeenCalledTimes(1);
  });

  it('records successful response times', () => {
    instrumentAxios(mockClient, 'success-api');
    const reqHandler = mockClient.interceptors.request.use.mock.calls[0][0];
    const resHandler = mockClient.interceptors.response.use.mock.calls[0][0];

    const config = {};
    reqHandler(config);
    expect(config).toHaveProperty('_startTime');

    // Simuler un appel réussi rapide
    config._startTime = Date.now() - 100;
    resHandler({ config, status: 200 });

    const stats = getStats();
    expect(stats).toHaveProperty('success-api');
    expect(stats['success-api'].totalCalls).toBe(1);
    expect(stats['success-api'].avgResponseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('records errors separately', async () => {
    instrumentAxios(mockClient, 'error-api');
    const reqHandler = mockClient.interceptors.request.use.mock.calls[0][0];
    const errHandler = mockClient.interceptors.response.use.mock.calls[0][1];

    const config = { method: 'get', url: '/test' };
    reqHandler(config);
    config._startTime = Date.now() - 50;

    await expect(errHandler({ config, message: 'Network Error' })).rejects.toBeDefined();

    const stats = getStats();
    expect(stats['error-api'].totalCalls).toBe(1);
    expect(stats['error-api'].errors).toBe(1);
  });

  it('keeps a rolling window of max 100 samples', () => {
    instrumentAxios(mockClient, 'rolling-api');
    const reqHandler = mockClient.interceptors.request.use.mock.calls[0][0];
    const resHandler = mockClient.interceptors.response.use.mock.calls[0][0];

    for (let i = 0; i < 105; i++) {
      const config = {};
      reqHandler(config);
      config._startTime = Date.now() - 10;
      resHandler({ config });
    }

    const stats = getStats();
    expect(stats['rolling-api'].lastCallsCount).toBe(100);
    expect(stats['rolling-api'].totalCalls).toBe(105);
  });
});
