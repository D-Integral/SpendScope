import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createApp } from '../src/app.js';
import { initWebSocket } from '../src/ws/wsServer.js';
import { alice, createCategory, loginAgent, prisma } from './helpers.js';
import { monthKey } from '../src/services/budgetService.js';

const { app, sessionParser } = createApp();
const server = http.createServer(app);
initWebSocket(server, sessionParser);

let port = 0;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

interface WsMessage {
  type: string;
  threshold?: number;
  month?: string;
  [key: string]: unknown;
}

async function openSocket(cookie: string): Promise<{ ws: WebSocket; inbox: WsMessage[] }> {
  const inbox: WsMessage[] = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    headers: { Cookie: cookie },
  });
  ws.on('message', (raw) => {
    inbox.push(JSON.parse(raw.toString()) as WsMessage);
  });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  await waitFor(inbox, (m) => m.type === 'connected');
  return { ws, inbox };
}

async function waitFor(
  inbox: WsMessage[],
  predicate: (msg: WsMessage, all: WsMessage[]) => boolean,
  timeoutMs = 4000
): Promise<WsMessage[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (inbox.some((msg, _i, all) => predicate(msg, all))) return inbox;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(
    `Timed out waiting for WebSocket message. Received: ${JSON.stringify(inbox)}`
  );
}

describe('WebSocket budget threshold alerts', () => {
  it('fires 50%, 80%, and 100% alerts once for the current month', async () => {
    const { agent, cookie } = await loginAgent(app, alice);
    const month = monthKey();
    const category = await createCategory(agent, 'Alerts');
    await agent.put(`/api/budgets/${month}`).send({ amount: 100 }).expect(200);

    const { ws, inbox } = await openSocket(cookie);

    ws.send(JSON.stringify({ type: 'subscribe' }));
    await waitFor(inbox, (m) => m.type === 'subscribed');

    await agent.post('/api/transactions').send({
      title: 'Half',
      amount: 50,
      date: `${month}-10`,
      categoryId: category.id,
    }).expect(201);
    await waitFor(inbox, (m) => m.type === 'budget_alert' && m.threshold === 50);

    await agent.post('/api/transactions').send({
      title: 'More',
      amount: 30,
      date: `${month}-11`,
      categoryId: category.id,
    }).expect(201);
    await waitFor(inbox, (m) => m.type === 'budget_alert' && m.threshold === 80);

    await agent.post('/api/transactions').send({
      title: 'Over',
      amount: 20,
      date: `${month}-12`,
      categoryId: category.id,
    }).expect(201);
    await waitFor(inbox, (m) => m.type === 'budget_alert' && m.threshold === 100);

    const thresholds = inbox
      .filter((m) => m.type === 'budget_alert')
      .map((m) => m.threshold);
    expect(thresholds).toEqual([50, 80, 100]);

    const before = inbox.length;
    await agent
      .post('/api/transactions')
      .send({
        title: 'Extra',
        amount: 5,
        date: `${month}-13`,
        categoryId: category.id,
      })
      .expect(201);
    await new Promise((r) => setTimeout(r, 200));
    expect(inbox.filter((m) => m.type === 'budget_alert')).toHaveLength(3);
    expect(inbox.length).toBe(before);

    const states = await prisma.alertState.findMany({ orderBy: { threshold: 'asc' } });
    expect(states.map((s) => s.threshold)).toEqual([50, 80, 100]);

    ws.close();
  });

  it('does not generate alerts when no budget is set', async () => {
    const { agent, cookie } = await loginAgent(app, alice);
    const month = monthKey();
    const category = await createCategory(agent, 'No Budget');
    const { ws, inbox } = await openSocket(cookie);

    await agent.post('/api/transactions').send({
      title: 'Spend',
      amount: 999,
      date: `${month}-15`,
      categoryId: category.id,
    }).expect(201);

    await new Promise((r) => setTimeout(r, 200));
    expect(inbox.filter((m) => m.type === 'budget_alert')).toHaveLength(0);
    expect(await prisma.alertState.count()).toBe(0);
    ws.close();
  });

  it('acknowledges an alert so it is not re-delivered on the next connection', async () => {
    const { agent, cookie } = await loginAgent(app, alice);
    const month = monthKey();
    const category = await createCategory(agent, 'Ack');
    await agent.put(`/api/budgets/${month}`).send({ amount: 100 }).expect(200);

    const first = await openSocket(cookie);
    first.ws.send(JSON.stringify({ type: 'subscribe' }));

    await agent.post('/api/transactions').send({
      title: 'Half',
      amount: 50,
      date: `${month}-10`,
      categoryId: category.id,
    }).expect(201);
    await waitFor(first.inbox, (m) => m.type === 'budget_alert' && m.threshold === 50);

    first.ws.send(JSON.stringify({ type: 'ack', month, threshold: 50 }));
    await waitFor(first.inbox, (m) => m.type === 'ack_ok' && m.threshold === 50);
    first.ws.close();
    await new Promise((r) => setTimeout(r, 50));

    const second = await openSocket(cookie);
    second.ws.send(JSON.stringify({ type: 'subscribe' }));
    await waitFor(second.inbox, (m) => m.type === 'subscribed');
    await new Promise((r) => setTimeout(r, 150));
    expect(second.inbox.filter((m) => m.type === 'budget_alert')).toHaveLength(0);
    second.ws.close();
  });
});
