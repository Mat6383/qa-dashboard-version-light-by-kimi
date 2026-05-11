/**
 * Notifications API methods
 */

import type {
  ApiResponse,
  NotificationSettings,
} from '../../types/api.types';
import { apiClient, apiCall } from './core';

export async function getNotificationSettings(projectId: number | null = null): Promise<ApiResponse<NotificationSettings>> {
  return apiCall('Get Notification Settings', async () => {
    const url = projectId ? `/notifications/settings/${projectId}` : '/notifications/settings';
    const response = await apiClient.get(url);
    return response.data;
  });
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<ApiResponse<NotificationSettings>> {
  return apiCall('Save Notification Settings', async () => {
    const response = await apiClient.put('/notifications/settings', settings);
    return response.data;
  });
}

export async function testNotificationWebhook(channel: string, url: string): Promise<ApiResponse<unknown>> {
  return apiCall('Test Notification Webhook', async () => {
    const response = await apiClient.post('/notifications/test', { channel, url });
    return response.data;
  });
}
