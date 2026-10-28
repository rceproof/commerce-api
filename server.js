const express = require('express');
const app = express();
const pool = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const ms = require('ms');
const { body, param, query, validationResult } = require('express-validator');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`필수 환경변수가 설정되지 않았습니다: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// 타이밍 공격 방어용 더미 해시: 없는 이메일 로그인 시에도 compare를 수행해
// 응답 시간으로 계정 존재 여부가 노출되지 않게 함
const DUMMY_HASH = bcrypt.hashSync('dummy_password', 12);

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: '유효하지 않은 토큰입니다' });
  }
}

const loginLimiter = rateLimit({
  windowMs: ms('15m'), // 15분
  max: 5, // IP당 15분에 5회까지
  message: { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: ms('1h'), // 1시간
  max: 10, // 1시간에 10회
  message: { error: '회원가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요' },
  standardHeaders: true,
  legacyHeaders: false,
});

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Commerce API',
      version: '1.0.0',
      description: '주문, 결제, 포인트 커머스 백엔드 API',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./server.js'],
});

if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.get('/', (req, res) => {
  res.send('환영합니다! Commerce API 입니다');
});

/**
 * @swagger
 * /signup:
 *   post:
 *    summary: 회원 가입
 *    tags: [인증]
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required: [email, password]
 *            properties:
 *              email:
 *                type: string
 *                example: test@example.com
 *              password:
 *                type: string
 *                example: password123
 *    responses:
 *     201:
 *       description: 회원가입 성공
 *     400:
 *       description: 입력값 검증 실패
 *     409:
 *       description: 이미 존재하는 이메일
 */

app.post(
  '/signup',
  signupLimiter,
  // 대소문자·공백 정규화로 중복 계정 방지
  body('email').isEmail().withMessage('올바른 이메일 형식이 아닙니다').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('비밀번호는 8자 이상이어야 합니다'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashedPassword],
    );
    res.status(201).json(result.rows[0]);
  }),
);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: 로그인
 *     tags: [인증]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 example: test1234
 *     responses:
 *       200:
 *         description: 로그인 성공
 *       400:
 *         description: 입력값 검증 실패
 *       401:
 *         description: 인증 실패
 */

app.post(
  '/login',
  loginLimiter,
  // 저장된 이메일이 정규화돼 있으므로 조회 이메일도 동일하게 정규화
  body('email').notEmpty().withMessage('email은 필수입니다').normalizeEmail(),
  body('password').notEmpty().withMessage('password는 필수입니다'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // 이메일이 없어도 더미 해시로 compare를 돌려 응답 시간을 맞춤 (타이밍 공격 방어)
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !isMatch) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token });
  }),
);

/**
 * @swagger
 * /me:
 *   get:
 *    summary: 내 정보 조회
 *    tags: [인증]
 *    security:
 *      - bearerAuth: []
 *    responses:
 *      200:
 *        description: 사용자 정보 반환
 *      401:
 *        description: 토큰 없음
 *      403:
 *        description: 토큰 검증 실패
 */

app.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

/**
 * @swagger
 * /products:
 *  get:
 *   summary: 상품 목록 조회
 *   tags: [상품]
 *   responses:
 *     200:
 *       description: 상품 목록 반환
 */

app.get(
  '/products',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  }),
);

/**
 * @swagger
 * /products/{id}:
 *    get:
 *      summary: 상품 상세 조회
 *      tags: [상품]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: integer
 *          description: 상품 ID
 *      responses:
 *        200:
 *          description: 상품 정보 반환
 *        400:
 *          description: 잘못된 ID 형식
 *        404:
 *          description: 상품 없음
 */

app.get(
  '/products/:id',
  param('id').isInt({ min: 1 }).withMessage('id는 1 이상의 정수여야 합니다'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = Number(req.params.id);

    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '상품을 찾을 수 없습니다' });
    }

    res.json(result.rows[0]);
  }),
);

/**
 * @swagger
 * /orders:
 *   get:
 *    summary: 내 주문 목록 조회 (페이지네이션)
 *    tags: [주문]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: query
 *        name: page
 *        schema:
 *          type: integer
 *          default: 1
 *        description: 페이지 번호 (1부터)
 *      - in: query
 *        name: limit
 *        schema:
 *          type: integer
 *          default: 20
 *          maximum: 100
 *        description: 페이지당 개수 (최대 100)
 *    responses:
 *      200:
 *        description: 주문 목록 + 페이지 메타(total, totalPages) 반환
 *      401:
 *        description: 토큰 없음
 *      403:
 *        description: 토큰 검증 실패
 */

app.get(
  '/orders',
  authenticateToken,
  query('page').optional().isInt({ min: 1 }).withMessage('page는 1 이상의 정수여야 합니다').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit은 1~100 사이의 정수여야 합니다')
    .toInt(),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const userId = req.user.userId;

    // 전체 개수 ( 전체 페이지 수 계산용)
    const countResult = await pool.query('SELECT COUNT(*) FROM orders WHERE user_id = $1', [
      userId,
    ]);
    const total = Number(countResult.rows[0].count);

    // 해당 페이지 데이터만 (IDOR 방어: userId는 토큰에서)
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY order_id LIMIT $2 OFFSET $3',
      [userId, limit, offset],
    );

    res.json({
      data: result.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *    summary: 주문 상세 조회
 *    tags: [주문]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: integer
 *        description: 주문 ID
 *    responses:
 *      200:
 *        description: 주문 정보 반환
 *      401:
 *        description: 토큰 없음
 *      403:
 *        description: 토큰 검증 실패
 *      404:
 *        description: 주문 없음 (타인 주문도 404 - IDOR 방어)
 */

app.get(
  '/orders/:id',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('id는 1 이상의 정수여야 합니다'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orderId = Number(req.params.id);

    // IDOR 방어: 본인 소유의 주문만 조회
    const result = await pool.query('SELECT * FROM orders WHERE order_id = $1 AND user_id = $2', [
      orderId,
      req.user.userId,
    ]);

    if (result.rows.length === 0) {
      // 본인 소유가 아니거나 존재하지 않는 주문은 404 반환 (403이면 주문 존재 여부를 확인할 수 있음)
      return res.status(404).json({ error: '주문을 찾을 수 없습니다' });
    }

    res.json(result.rows[0]);
  }),
);

/**
 * @swagger
 * /orders:
 *   post:
 *      summary: 주문 생성 (결제)
 *      tags: [주문]
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required: [productId, quantity]
 *              properties:
 *                productId:
 *                  type: integer
 *                  example: 2
 *                quantity:
 *                  type: integer
 *                  example: 1
 *      responses:
 *        201:
 *          description: 주문 생성 성공
 *        400:
 *          description: 입력값 검증 실패 또는 포인트 부족
 *        401:
 *          description: 토큰 없음
 *        403:
 *          description: 토큰 검증 실패
 *        404:
 *          description: 상품 없음
 */

app.post(
  '/orders',
  authenticateToken,
  body('productId').isInt({ min: 1 }).withMessage('productId는 1 이상의 정수여야 합니다'),
  body('quantity')
    .isInt({ min: 1, max: 1000 })
    .withMessage('quantity는 1~1000 사이의 정수여야 합니다'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, quantity } = req.body;
    const userId = req.user.userId;

    const client = await pool.connect();
    try {
      // 상품 조회 (BEGIN 전 = 트랜잭션 밖, 단 try 안이라 에러는 잡힘)
      const productResult = await client.query('SELECT name, price FROM products WHERE id = $1', [
        productId,
      ]);
      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: '상품을 찾을 수 없습니다' });
      }
      const { name, price } = productResult.rows[0];
      const total = price * quantity;

      await client.query('BEGIN');

      // 포인트 행 잠금(FOR UPDATE) + 잔액 확인
      const userResult = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
      }
      if (userResult.rows[0].points < total) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '포인트가 부족합니다' });
      }

      //포인트 차감
      await client.query('UPDATE users SET points = points - $1 WHERE id = $2', [total, userId]);

      //주문 생성
      const orderResult = await client.query(
        'INSERT INTO orders (user_id, product_id, product, quantity, total) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, productId, name, quantity, total],
      );

      await client.query('COMMIT');
      res.status(201).json(orderResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

/**
 * @swagger
 * /orders/{id}:
 *  delete:
 *    summary: 주문 취소 (환불)
 *    tags: [주문]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: integer
 *        description: 주문 ID
 *    responses:
 *      200:
 *        description: 취소 성공 (환불 금액 반환)
 *      401:
 *        description: 토큰 없음
 *      403:
 *        description: 토큰 검증 실패
 *      404:
 *        description: 주문 없음 (이미 취소됨/타인 주문 포함 - 이중환불 방어)
 */

app.delete(
  '/orders/:id',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('id는 1 이상의 정수여야 합니다'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orderId = Number(req.params.id);
    const userId = req.user.userId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 취소 대상 조회 + 행 잠금: 본인 것 + 아직 'active'인 것만 (이미 취소된 건 안 잡힘)
      const orderResult = await client.query(
        "SELECT total FROM orders WHERE order_id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE",
        [orderId, userId],
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '취소할 주문을 찾을 수 없습니다' });
      }
      const { total } = orderResult.rows[0];

      // 주문 취소 (soft delete)
      await client.query("UPDATE orders SET status = 'cancelled' WHERE order_id = $1", [orderId]);

      // 포인트 환불
      await client.query('UPDATE users SET points = points + $1 WHERE id = $2', [total, userId]);

      await client.query('COMMIT');
      res.json({ message: '주문이 취소되었습니다', refunded: total });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

/**
 * @swagger
 * /points/charge:
 *  post:
 *    summary: 포인트 충전
 *    tags: [포인트]
 *    security:
 *      - bearerAuth: []
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required: [amount]
 *            properties:
 *              amount:
 *                type: integer
 *                example: 100000
 *    responses:
 *      200:
 *        description: 충전 성공 (잔액 반환)
 *      400:
 *        description: 입력값 검증 실패
 *      401:
 *        description: 토큰 없음
 *      403:
 *        description: 토큰 검증 실패
 */

app.post(
  '/points/charge',
  authenticateToken,
  body('amount').isInt({ min: 1 }).withMessage('amount는 1 이상의 정수여야 합니다'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount } = req.body;
    const userId = req.user.userId;

    //    테스트용 충전: 실서비스에서는 PG(포트원/토스 등)에
    //    결제 완료를 server-to-server로 검증한 뒤에만 적립해야 함
    //    (클라이언트의 "결제 완료"를 신뢰하지 않는 것이 핵심)
    // 원자적 증가: 현재 포인트에 amount 더함 (동시 충전도 안전하게 누적)
    const result = await pool.query(
      'UPDATE users SET points = points + $1 WHERE id = $2 RETURNING points',
      [amount, userId],
    );

    if (result.rows.length === 0) {
      // 0건 = 해당 유저 없음 (인증됐으니 드물지만 방어)
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    res.json({ points: result.rows[0].points });
  }),
);

/**
 * @swagger
 * /points/use:
 *  post:
 *    summary: 포인트 사용 (차감)
 *    tags: [포인트]
 *    security:
 *      - bearerAuth: []
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required: [amount]
 *            properties:
 *              amount:
 *                type: integer
 *                example: 50000
 *    responses:
 *      200:
 *        description: 사용 성공 (잔액 반환)
 *      400:
 *        description: 입력값 검증 실패 또는 포인트 부족
 *      401:
 *        description: 토큰 없음
 *      403:
 *        description: 토큰 검증 실패
 */

app.post(
  '/points/use',
  authenticateToken,
  body('amount').isInt({ min: 1 }).withMessage('amount는 1 이상의 정수여야 합니다'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { amount } = req.body;
    const userId = req.user.userId;

    // 원자적 차감: 잔액 충분할 때만(WHERE points >= $1 차감 - 확인+차감을 한 쿼리로 (레이스컨디션 방어))
    const result = await pool.query(
      'UPDATE users SET points = points - $1 WHERE id = $2 AND points >= $1 RETURNING points',
      [amount, userId],
    );

    if (result.rows.length === 0) {
      // 0건 = 잔액 부족 (WHERE 조건에 안 맞아 아무것도 안 바뀜)
      return res.status(400).json({ error: '포인트가 부족합니다' });
    }

    res.json({ points: result.rows[0].points });
  }),
);

app.use((req, res) => {
  res.status(404).json({ error: '요청하신 경로를 찾을 수 없습니다' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '잘못된 JSON 형식입니다' });
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: '이미 가입된 이메일입니다' });
  }
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

if (require.main === module) {
  const cluster = require('cluster');

  if (cluster.isPrimary) {
    // 워커마다 DB 풀이 생기므로 워커수 X DB_POOL_MAX < Postgre max_connections(기본 100) 유지
    const numWorkers = Number(process.env.WORKERS) || 4;
    console.log(`Primary ${process.pid} - 워커 ${numWorkers}개 포크`);
    for (let i = 0; i < numWorkers; i++) cluster.fork();

    cluster.on('exit', (worker) => {
      console.log(`워커 ${worker.process.pid} 종료 → 재포크`);
      cluster.fork();
    });
  } else {
    app.listen(3000, () => {
      console.log('서버 실행중 http://localhost:3000');
    });
  }
}
module.exports = app;
