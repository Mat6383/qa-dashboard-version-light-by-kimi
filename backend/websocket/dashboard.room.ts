import type WebSocket from 'ws';
import logger from '../services/logger.service';
import testmoService from '../services/testmo.service';

export interface WSMessage {
  type: 'metrics' | 'error' | 'pong';
  payload?: any;
  timestamp?: string;
}

export class DashboardRoom {
  projectId: number;
  preprodMilestones: number[] | null;
  prodMilestones: number[] | null;
  clients: Set<WebSocket>;
  private lastHash: string | null = null;
  private interval: NodeJS.Timeout | null = null;

  constructor(
    projectId: number,
    preprodMilestones?: number[] | null,
    prodMilestones?: number[] | null
  ) {
    this.projectId = projectId;
    this.preprodMilestones = preprodMilestones || null;
    this.prodMilestones = prodMilestones || null;
    this.clients = new Set();
  }

  addClient(ws: WebSocket) {
    this.clients.add(ws);
    logger.info(`[DashboardRoom:${this.projectId}] Client connecté (${this.clients.size} total)`);
    if (this.clients.size === 1) {
      this.startPolling();
    }
    this.send(ws, { type: 'pong', payload: { status: 'subscribed', projectId: this.projectId } });
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws);
    logger.info(`[DashboardRoom:${this.projectId}] Client déconnecté (${this.clients.size} restants)`);
    if (this.clients.size === 0) {
      this.stopPolling();
    }
  }

  private startPolling() {
    if (this.interval) return;
    logger.info(`[DashboardRoom:${this.projectId}] Démarrage polling`);
    this.fetchAndBroadcast();
    this.interval = setInterval(() => this.fetchAndBroadcast(), 30000);
  }

  private stopPolling() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info(`[DashboardRoom:${this.projectId}] Arrêt polling`);
    }
  }

  private async fetchAndBroadcast() {
    try {
      const [metrics, qualityRates] = await Promise.all([
        testmoService.getProjectMetrics(
          this.projectId,
          this.preprodMilestones,
          this.prodMilestones
        ),
        testmoService.getEscapeAndDetectionRates(
          this.projectId,
          this.preprodMilestones,
          this.prodMilestones
        ),
      ]);
      const payload = { metrics, qualityRates, timestamp: new Date().toISOString() };
      const hash = JSON.stringify(payload);
      if (hash !== this.lastHash) {
        this.lastHash = hash;
        this.broadcast({ type: 'metrics', payload });
      }
    } catch (err: any) {
      logger.error(`[DashboardRoom:${this.projectId}] Erreur polling:`, err.message);
      this.broadcast({ type: 'error', payload: { message: err.message } });
    }
  }

  private broadcast(msg: WSMessage) {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        client.send(data);
      }
    }
  }

  private send(ws: WebSocket, msg: WSMessage) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }
}
