/**
 * ================================================
 * API Core — Axios client, helpers & shared types
 * ================================================
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT, axiosCredentials } from '../http.config';

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  ...axiosCredentials,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers['x-request-id'] = config.headers['x-request-id'] || generateRequestId();
    const token = localStorage.getItem('qa_dashboard_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error: AxiosError) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[API] Request error:', error);
    }
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[API] Response:`, response.status, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    if (import.meta.env.DEV) {
      console.error('[API] Response error:', error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export { apiClient };

export interface ReportGenerateParams {
  projectId: number;
  milestoneId?: number;
  runIds?: (number | string)[];
  formats?: { html?: boolean; pptx?: boolean };
  recommendations?: string[];
  complement?: string;
  lang?: 'fr' | 'en';
}

export interface ExportMilestones {
  preprod: number[];
  prod: number[];
}

export function handleError(operation: string, error: AxiosError | Error): Error {
  const axiosError = error as AxiosError<{ error?: string }>;
  const errorMessage = axiosError.response?.data?.error || error.message;
  console.error(`[API Service] ${operation} failed:`, errorMessage);
  return new Error(`${operation}: ${errorMessage}`);
}

export async function apiCall<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw handleError(operation, error as AxiosError | Error);
  }
}

export function mapSnakeToCamel(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

export function mapCamelToSnake(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}
