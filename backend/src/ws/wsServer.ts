import type { IncomingMessage, Server } from 'http';
import type { RequestHandler } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config.js';
import {
  acknowledgeAlert,
  evaluateNewAlerts,
  getUnacknowledgedAlerts,
} from '../services/alertService.js';

// Active sockets grouped by user so we only deliver a user's own alerts.
const userSockets = new Map<string, Set<WebSocket>>();

function addSocket(userId: string, ws: WebSocket) {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(ws);
}

function removeSocket(userId: string, ws: WebSocket) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
}

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * Evaluate the current month for a user and push any newly-crossed threshold
 * alerts to all of that user's connected sockets. Called after transaction
 * create/update/delete. Alerts fire once per threshold per month.
 */
export async function pushNewAlertsToUser(userId: string): Promise<void> {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) {
    // Still evaluate+persist so state is correct; nothing to deliver right now.
    await evaluateNewAlerts(userId, config.currency);
    return;
  }
  const alerts = await evaluateNewAlerts(userId, config.currency);
  for (const alert of alerts) {
    for (const ws of sockets) send(ws, alert);
  }
}

/** Parse the passport user id off the (cookie-authenticated) upgrade request. */
function authenticateUpgrade(
  sessionParser: RequestHandler,
  req: IncomingMessage
): Promise<string | null> {
  return new Promise((resolve) => {
    const stubRes = {
      getHeader: () => undefined,
      setHeader: () => undefined,
      end: () => undefined,
    };
    sessionParser(req as any, stubRes as any, () => {
      const userId = (req as any).session?.passport?.user ?? null;
      resolve(typeof userId === 'string' ? userId : null);
    });
  });
}

export function initWebSocket(server: Server, sessionParser: RequestHandler): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    // Only handle our WS path; ignore others (e.g. Vite HMR when proxied).
    const url = req.url ?? '';
    if (!url.startsWith('/ws')) return;

    const userId = await authenticateUpgrade(sessionParser, req);
    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, userId);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, userId: string) => {
    addSocket(userId, ws);

    // Attach listeners before any awaits so an immediate client `subscribe`
    // is not dropped while we evaluate alerts.
    ws.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, { type: 'error', message: 'Invalid JSON message.' });
      }

      try {
        switch (msg?.type) {
          case 'subscribe': {
            // Client -> server: (re)subscribe and receive current alerts.
            const pending = await getUnacknowledgedAlerts(userId, config.currency);
            send(ws, { type: 'subscribed', count: pending.length });
            for (const alert of pending) send(ws, alert);
            break;
          }
          case 'ack': {
            // Client -> server: acknowledge an alert so it is not re-delivered.
            const { month, threshold } = msg;
            if (typeof month === 'string' && typeof threshold === 'number') {
              const ok = await acknowledgeAlert(userId, month, threshold);
              send(ws, { type: 'ack_ok', month, threshold, acknowledged: ok });
            } else {
              send(ws, { type: 'error', message: 'ack requires { month, threshold }.' });
            }
            break;
          }
          case 'ping':
            send(ws, { type: 'pong' });
            break;
          default:
            send(ws, { type: 'error', message: `Unknown message type: ${msg?.type}` });
        }
      } catch {
        send(ws, { type: 'error', message: 'Failed to handle WebSocket message.' });
      }
    });

    ws.on('close', () => removeSocket(userId, ws));
    ws.on('error', () => removeSocket(userId, ws));

    send(ws, { type: 'connected', userId });

    // Generate alerts on connection open (re-deliver unacknowledged thresholds).
    void (async () => {
      try {
        await evaluateNewAlerts(userId, config.currency);
        const pending = await getUnacknowledgedAlerts(userId, config.currency);
        for (const alert of pending) send(ws, alert);
      } catch {
        send(ws, { type: 'error', message: 'Failed to evaluate budget alerts.' });
      }
    })();
  });

  return wss;
}
