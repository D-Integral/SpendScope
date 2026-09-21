import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { alice, bob, createCategory, loginAgent } from './helpers.js';

const { app } = createApp();

describe('authorization: users cannot access another user\'s data', () => {
  it('hides categories, transactions, and budgets owned by another user', async () => {
    const { agent: aliceAgent } = await loginAgent(app, alice);
    const { agent: bobAgent } = await loginAgent(app, bob);

    const category = await createCategory(aliceAgent, 'Alice Only');
    const tx = await aliceAgent
      .post('/api/transactions')
      .send({
        title: 'Secret purchase',
        amount: 42,
        date: '2026-09-21',
        categoryId: category.id,
      })
      .expect(201);

    await aliceAgent.put('/api/budgets/2026-09').send({ amount: 500 }).expect(200);

    const bobCategories = await bobAgent.get('/api/categories').expect(200);
    expect(bobCategories.body).toEqual([]);

    const bobTx = await bobAgent.get('/api/transactions').expect(200);
    expect(bobTx.body).toEqual([]);

    await bobAgent.get(`/api/categories/${category.id}`).expect(404);
    await bobAgent.patch(`/api/categories/${category.id}`).send({ name: 'Hijack' }).expect(404);
    await bobAgent.delete(`/api/categories/${category.id}`).expect(404);

    await bobAgent.patch(`/api/transactions/${tx.body.id}`).send({ title: 'Nope' }).expect(404);
    await bobAgent.delete(`/api/transactions/${tx.body.id}`).expect(404);

    const bobBudget = await bobAgent.get('/api/budgets/2026-09').expect(200);
    expect(bobBudget.body.hasBudget).toBe(false);
    expect(bobBudget.body.spent).toBe(0);
  });

  it('rejects creating a transaction in another user\'s category', async () => {
    const { agent: aliceAgent } = await loginAgent(app, alice);
    const { agent: bobAgent } = await loginAgent(app, bob);
    const category = await createCategory(aliceAgent, 'Alice Cat');

    await bobAgent
      .post('/api/transactions')
      .send({
        title: 'Sneaky',
        amount: 5,
        date: '2026-09-21',
        categoryId: category.id,
      })
      .expect(400);
  });
});
