const request = require('supertest');
const app = require('../server');
const pool = require('../db');

describe('GET /', () => {
  it('환영 메시지를 200으로 응답한다', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Commerce API');
  });
});

describe('GET /products', () => {
  it('상품 목록을 배열로 200 응답한다', async () => {
    const res = await request(app).get('/products');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

afterAll(async () => {
  await pool.end(); // DB 커넥션 풀 정리 (안 하면 테스트가 안 끝나고 멈춰있음)
});
