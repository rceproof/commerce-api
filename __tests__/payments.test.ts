import request from 'supertest';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

jest.mock('../tossClient'); // 토스 호출을 가짜(대역)로 — — 실제 PG 대신 대역으로 테스트
import app from '../server';
import pool from '../db';
import * as tossClient from '../tossClient';

const mockedConfirm = jest.mocked(tossClient.confirmPayment); // 타입 있는 목 핸들

async function createTestUser(email: string, password = 'password123#') {
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
    [email, hash],
  );
  const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  return { userId: rows[0].id, token };
}

// READY 결제 하나 생성 (주문 생성 → 결제 시작) → { orderUid, amount }
async function createReadyPayment(token: string) {
  const orderRes = await request(app)
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: 2, quantity: 1 }); // 마우스 25000
  const payRes = await request(app)
    .post('/payments')
    .set('Authorization', `Bearer ${token}`)
    .send({ orderId: orderRes.body.order_id });
  return { orderUid: payRes.body.order_uid, amount: payRes.body.amount };
}

describe('POST /payments/confirm (결제 승인 — 토스 목킹)', () => {
  let token: string;

  beforeAll(async () => {
    const u = await createTestUser('payment-confirm@example.com');
    token = u.token;
    await request(app)
      .post('/points/charge')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500000 }); // 주문 여러 건 결제할 포인트
  });

  beforeEach(() => {
    mockedConfirm.mockReset(); // 각 테스트마다 대역 초기화
  });

  it('토스 승인 성공 → 200 DONE', async () => {
    const { orderUid, amount } = await createReadyPayment(token);
    mockedConfirm.mockResolvedValue({ ok: true, data: {} }); // "토스가 승인했다 치고"

    const res = await request(app)
      .post('/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentKey: randomUUID(), orderId: orderUid, amount });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DONE');
    expect(mockedConfirm).toHaveBeenCalledTimes(1); // 토스 호출됨
  });

  it('금액 불일치 → 400 (변조 방어, 토스 호출 전 차단)', async () => {
    const { orderUid, amount } = await createReadyPayment(token);

    const res = await request(app)
      .post('/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentKey: randomUUID(), orderId: orderUid, amount: amount + 1 }); // 변조

    expect(res.status).toBe(400);
    expect(mockedConfirm).not.toHaveBeenCalled(); // 변조는 토스 호출 전에 막힘
  });

  it('이미 승인된 결제 재요청 → 409 (멱등성)', async () => {
    const { orderUid, amount } = await createReadyPayment(token);
    mockedConfirm.mockResolvedValue({ ok: true, data: {} });
    const key = randomUUID();

    // 1차 승인 → DONE
    await request(app)
      .post('/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentKey: key, orderId: orderUid, amount });

    // 2차 재요청 → 409 (토스 재호출 없이 상태에서 차단)
    const res = await request(app)
      .post('/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentKey: key, orderId: orderUid, amount });

    expect(res.status).toBe(409);
    expect(mockedConfirm).toHaveBeenCalledTimes(1); // 1차만 호출
  });

  it('존재하지 않는 주문 → 404', async () => {
    const res = await request(app)
      .post('/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentKey: randomUUID(), orderId: randomUUID(), amount: 25000 });

    expect(res.status).toBe(404);
  });

  it('토스 승인 거부 → 502', async () => {
    const { orderUid, amount } = await createReadyPayment(token);
    mockedConfirm.mockResolvedValue({ ok: false, message: '승인 거부' }); // "토스가 거부했다 치고"

    const res = await request(app)
      .post('/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentKey: randomUUID(), orderId: orderUid, amount });

    expect(res.status).toBe(502);
  });

  afterAll(async () => {
    await pool.end();
  });
});
