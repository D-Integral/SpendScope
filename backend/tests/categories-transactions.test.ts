import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { alice, createCategory, loginAgent } from './helpers.js';

const { app } = createApp();

describe('categories and transactions', () => {
  it('creates a category and a transaction', async () => {
    const { agent } = await loginAgent(app, alice);
    const category = await createCategory(agent, 'Groceries');

    const created = await agent
      .post('/api/transactions')
      .send({
        title: 'Farmers market',
        amount: 24.5,
        date: '2026-09-21',
        categoryId: category.id,
        notes: 'Vegetables',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      title: 'Farmers market',
      amount: 24.5,
      currency: 'USD',
      categoryId: category.id,
      notes: 'Vegetables',
    });
    expect(created.body.id).toBeTruthy();

    const list = await agent.get('/api/transactions').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].category.name).toBe('Groceries');
  });

  it('rejects invalid transaction payloads', async () => {
    const { agent } = await loginAgent(app, alice);
    const category = await createCategory(agent, 'Travel');

    await agent
      .post('/api/transactions')
      .send({ title: '', amount: 10, date: '2026-09-21', categoryId: category.id })
      .expect(400);

    await agent
      .post('/api/transactions')
      .send({ title: 'Zero', amount: 0, date: '2026-09-21', categoryId: category.id })
      .expect(400);

    await agent
      .post('/api/transactions')
      .send({ title: 'Bad date', amount: 10, date: 'not-a-date', categoryId: category.id })
      .expect(400);
  });

  it('blocks deleting a category that still has transactions', async () => {
    const { agent } = await loginAgent(app, alice);
    const category = await createCategory(agent, 'Dining');
    await agent
      .post('/api/transactions')
      .send({
        title: 'Lunch',
        amount: 12,
        date: '2026-09-10',
        categoryId: category.id,
      })
      .expect(201);

    const del = await agent.delete(`/api/categories/${category.id}`).expect(409);
    expect(del.body.error).toMatch(/not empty/i);
  });

  it('filters and searches transactions', async () => {
    const { agent } = await loginAgent(app, alice);
    const food = await createCategory(agent, 'Food');
    const rent = await createCategory(agent, 'Rent');

    await agent.post('/api/transactions').send({
      title: 'Coffee beans',
      amount: 18,
      date: '2026-09-05',
      categoryId: food.id,
      notes: 'Ethiopian roast',
    });
    await agent.post('/api/transactions').send({
      title: 'Apartment',
      amount: 900,
      date: '2026-08-01',
      categoryId: rent.id,
      notes: 'August rent',
    });

    const search = await agent.get('/api/transactions').query({ q: 'Ethiopian' }).expect(200);
    expect(search.body).toHaveLength(1);
    expect(search.body[0].title).toBe('Coffee beans');

    const byCategory = await agent
      .get('/api/transactions')
      .query({ categoryId: rent.id })
      .expect(200);
    expect(byCategory.body).toHaveLength(1);

    const byAmount = await agent
      .get('/api/transactions')
      .query({ minAmount: 10, maxAmount: 50 })
      .expect(200);
    expect(byAmount.body).toHaveLength(1);

    const byDate = await agent
      .get('/api/transactions')
      .query({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
      .expect(200);
    expect(byDate.body).toHaveLength(1);
    expect(byDate.body[0].title).toBe('Coffee beans');
  });
});
