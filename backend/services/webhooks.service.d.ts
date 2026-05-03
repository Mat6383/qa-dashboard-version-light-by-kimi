/**
 * Types pour WebhooksService.
 */

export interface WebhookSubscription {
  id: number;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface WebhooksService {
  create(url: string, events: string[], secret: string): WebhookSubscription | null;
  getAll(): WebhookSubscription[];
  getById(id: number): WebhookSubscription | null;
  update(
    id: number,
    patch: Partial<Pick<WebhookSubscription, 'url' | 'events' | 'enabled'> & { secret: string }>
  ): boolean;
  delete(id: number): boolean;
  trigger(event: string, payload: Record<string, unknown>): void;
}

declare const webhooksService: WebhooksService;
export = webhooksService;
