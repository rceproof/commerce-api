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

describe('회원가입, 로그인 흐름', () => {
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

describe('인증 가드', () => {
  it('토큰 없이 주문 목록 요청 시 401', async () => {
    const res = await request(app).get('/orders');

    expect(res.status).toBe(401);
  });

  it('잘못된 토큰으로 요청 시 403', async () => {
    const res = await request(app).get('/orders').set('Authorization', 'Bearer faketoken');

    expect(res.status).toBe(403);
  });
});
