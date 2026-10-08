const request = require('supertest');
const app = require('../server');
const pool = require('../db');

describe('GET / (환영 응답)', () => {
  it('환영 메시지를 200으로 응답한다', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Commerce API');
  });
});

describe('GET /products (상품 목록)', () => {
  it('상품 목록을 배열로 200 응답한다', async () => {
    const res = await request(app).get('/products');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /signup, /login (회원가입, 로그인)', () => {
  const testUser = { email: 'authtest@example.com', password: 'password123#' };

  beforeAll(async () => {
    // 반복 가능하게: 이 테스트 유저가 이전 실행에서 남아있으면 먼저 지움
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
  });

  it('회원가입 -> 201과 유저 정보를 반환하고 비밀번호는 노출하지 않는다', async () => {
    const res = await request(app).post('/signup').send(testUser);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe(testUser.email);
    expect(res.body).not.toHaveProperty('password'); // 비밀번호 노출 안됨
  });

  it('로그인 -> 200과 토큰을 반환한다', async () => {
    const res = await request(app).post('/login').send(testUser);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});

describe('GET /orders (토큰 인증 가드)', () => {
  it('토큰 없이 주문 목록 요청 시 401', async () => {
    const res = await request(app).get('/orders');

    expect(res.status).toBe(401);
  });

  it('잘못된 토큰으로 요청 시 403', async () => {
    const res = await request(app).get('/orders').set('Authorization', 'Bearer faketoken');

    expect(res.status).toBe(403);
  });
});

describe('GET /orders/:id (IDOR 방어 주문 조회)', () => {
  const userA = { email: 'idor-a@example.com', password: 'password123#' };
  const userB = { email: 'idor-b@example.com', password: 'password123#' };
  let tokenA;
  let tokenB;
  let orderIdA;

  beforeAll(async () => {
    // 반복 가능하게: 이전 테스트 유저 정리
    await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [userA.email, userB.email]);

    // A, B 가입
    await request(app).post('/signup').send(userA);
    await request(app).post('/signup').send(userB);

    // A, B 로그인 -> 토큰 확보
    const resA = await request(app).post('/login').send(userA);
    tokenA = resA.body.token;
    const resB = await request(app).post('/login').send(userB);
    tokenB = resB.body.token;

    await request(app)
      .post('/points/charge')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: 100000 });

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ productId: 2, quantity: 1 });
    orderIdA = orderRes.body.order_id;
  });

  it('A와 B 모두 가입 후 로그인 되어 토큰을 받는다', () => {
    expect(tokenA).toBeDefined();
    expect(tokenB).toBeDefined();
  });

  it('A는 자기 주문을 조회할 수 있다 (200)', async () => {
    const res = await request(app)
      .get(`/orders/${orderIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.order_id).toBe(orderIdA);
  });

  it('B는 A의 주문을 조회할 수 없다 (404)', async () => {
    const res = await request(app)
      .get(`/orders/${orderIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /orders/:id (주문 취소, 환불)', () => {
  const user = { email: 'cancel-test@example.com', password: 'password123#' };
  let token;
  let orderId;

  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [user.email]);
    await request(app).post('/signup').send(user);
    const res = await request(app).post('/login').send(user);
    token = res.body.token;

    await request(app)
      .post('/points/charge')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100000 });

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 2, quantity: 1 });
    orderId = orderRes.body.order_id;
  });

  it('주문 취소 시 200과 환불 금액을 반환한다', async () => {
    const res = await request(app)
      .delete(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(25000);
  });

  it('이미 취소된 주문을 또 취소하면 404 (이중 환불 방어)', async () => {
    const res = await request(app)
      .delete(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

afterAll(async () => {
  await pool.end(); // DB 커넥션 풀 정리 (안 하면 테스트가 안 끝나고 멈춰있음)
});
