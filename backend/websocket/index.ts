import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { URL } from 'url';
import logger from '../services/logger.service';
import { DashboardRoom } from './dashboard.room';

const rooms = new Map<string, DashboardRoom>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const projectId = url.searchParams.get('projectId');
    const preprod = url.searchParams.get('preprodMilestones')?.split(',').map(Number).filter(Boolean) || null;
    const prod = url.searchParams.get('prodMilestones')?.split(',').map(Number).filter(Boolean) || null;

    if (!projectId) {
      ws.close(1008, 'projectId required');
      return;
    }

    const roomKey = `${projectId}_${JSON.stringify(preprod)}_${JSON.stringify(prod)}`;
    let room = rooms.get(roomKey);
    if (!room) {
      room = new DashboardRoom(parseInt(projectId), preprod, prod);
      rooms.set(roomKey, room);
    }

    room.addClient(ws);

    ws.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch {
        // ignore invalid messages
      }
    });

    ws.on('close', () => {
      room!.removeClient(ws);
      if (room!.clients.size === 0) {
        rooms.delete(roomKey);
      }
    });

    ws.on('error', (err: Error) => {
      logger.error('[WebSocket] Erreur client:', err.message);
    });
  });

  // Heartbeat : ping natif WS toutes les 15s
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      if ((ws as any).isAlive === false) {
        ws.terminate();
        return;
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 15000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  wss.on('ping', (ws: WebSocket) => {
    (ws as any).isAlive = true;
  });

  server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    if (request.url?.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  logger.info('[WebSocket] Serveur WS prêt sur /ws/dashboard');
}
