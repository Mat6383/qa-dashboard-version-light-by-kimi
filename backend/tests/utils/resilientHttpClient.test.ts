/**
 * Tests unitaires — ResilientHttpClient
 */

jest.mock('../../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../services/apiTimer.service', () => ({
  instrumentAxios: jest.fn(),
}));

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
}));

let mockAxiosInstance: any;

import axios from 'axios';
import { ResilientHttpClient } from '../../utils/resilientHttpClient';

describe('ResilientHttpClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: { response: { use: jest.fn() } },
    };
  });

  it('crée un client axios avec la bonne config', () => {
    new ResilientHttpClient({
      baseURL: 'https://api.example.com',
      name: 'test-client',
      timeout: 5000,
      headers: { 'X-Custom': 'header' },
    });
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com',
      timeout: 5000,
      headers: { 'X-Custom': 'header' },
    });
  });

  it('get retourne la réponse en cas de succès', async () => {
    const client = new ResilientHttpClient({ baseURL: 'https://api.example.com', name: 'test' });
    mockAxiosInstance.get.mockResolvedValue({ data: 'ok' });
    const resp = await client.get('/test');
    expect(resp.data).toBe('ok');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', undefined);
  });

  it('post retourne la réponse en cas de succès', async () => {
    const client = new ResilientHttpClient({ baseURL: 'https://api.example.com', name: 'test' });
    mockAxiosInstance.post.mockResolvedValue({ data: { id: 1 } });
    const resp = await client.post('/items', { name: 'foo' });
    expect(resp.data).toEqual({ id: 1 });
  });

  it('put retourne la réponse en cas de succès', async () => {
    const client = new ResilientHttpClient({ baseURL: 'https://api.example.com', name: 'test' });
    mockAxiosInstance.put.mockResolvedValue({ data: { updated: true } });
    const resp = await client.put('/items/1', { name: 'bar' });
    expect(resp.data).toEqual({ updated: true });
  });

  it('delete retourne la réponse en cas de succès', async () => {
    const client = new ResilientHttpClient({ baseURL: 'https://api.example.com', name: 'test' });
    mockAxiosInstance.delete.mockResolvedValue({ data: null });
    const resp = await client.delete('/items/1');
    expect(resp.data).toBeNull();
  });

  it('retry sur erreur 500 puis succès', async () => {
    const client = new ResilientHttpClient({ baseURL: 'https://api.example.com', name: 'test', maxRetries: 2, baseDelayMs: 10 });
    mockAxiosInstance.get
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'Internal Server Error' })
      .mockResolvedValueOnce({ data: 'recovered' });

    const resp = await client.get('/test');
    expect(resp.data).toBe('recovered');
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
  });

  it('ne retry pas sur erreur 4xx (sauf 429)', async () => {
    const client = new ResilientHttpClient({ baseURL: 'https://api.example.com', name: 'test', maxRetries: 2, baseDelayMs: 10 });
    mockAxiosInstance.get.mockRejectedValue({ response: { status: 404 }, message: 'Not Found' });

    await expect(client.get('/test')).rejects.toEqual(
      expect.objectContaining({ response: { status: 404 } })
    );
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
  });

  it('retry sur 429 (rate limit)', async () => {
    const client = new ResilientHttpClient({ baseURL: 'https://api.example.com', name: 'test', maxRetries: 2, baseDelayMs: 10 });
    mockAxiosInstance.get
      .mockRejectedValueOnce({ response: { status: 429 }, message: 'Rate limit' })
      .mockResolvedValueOnce({ data: 'ok' });

    const resp = await client.get('/test');
    expect(resp.data).toBe('ok');
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
  });

  it('ouvre le circuit breaker après trop d échecs', async () => {
    const client = new ResilientHttpClient({
      baseURL: 'https://api.example.com',
      name: 'test',
      maxRetries: 1,
      baseDelayMs: 10,
      failureThreshold: 2,
      resetTimeoutMs: 10000,
    });
    mockAxiosInstance.get.mockRejectedValue({ response: { status: 500 }, message: 'fail' });

    // 2 échecs → circuit OPEN
    await expect(client.get('/test')).rejects.toBeDefined();
    await expect(client.get('/test')).rejects.toBeDefined();

    // 3ème appel → circuit breaker ouvert
    await expect(client.get('/test')).rejects.toThrow('CircuitBreaker [test] is OPEN');
  });

  it('expose le statut du circuit breaker', () => {
    const client = new ResilientHttpClient({ baseURL: 'https://api.example.com', name: 'test' });
    const status = client.circuitBreakerStatus;
    expect(status).toMatchObject({
      name: 'test',
      state: 'CLOSED',
      failures: 0,
    });
  });
});
