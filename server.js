const express = require("express");
const app = express();
const pool = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// 타이밍 공격 방어용 더미 해시: 없는 이메일 로그인 시에도 compare를 수행해
// 응답 시간으로 계정 존재 여부가 노출되지 않게 함 
const DUMMY_HASH = bcrypt.hashSync("dummy_password", 12);

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if(!token) { 
    return res.status(401).json({ error: " 인증 토큰이 필요합니다" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "유효하지 않은 토큰입니다"});
  }
}

app.use(express.json());

app.get("/", (req, res) => {
  res.send("환영합니다! Commerce API 입니다");
});

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return  res.status(400).json({ error: "email과 password는 필수입니다."}); 
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at",
      [email, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "이미 가입된 이메일입니다"});
    }
    res.status(500).json({ error: "서버 오류가 발생했습니다"});
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email과 password는 필수입니다"});
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    // 이메일이 없어도 더미 해시로 compare를 돌려 응답 시간을 맞춤 (타이밍 공격 방어)
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !isMatch) {
      return res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다"});
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email},
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류가 발생했습니다"});
  }
});

app.get("/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.get("/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id");
    res.json(result.rows);
  } catch (err){
    res.status(500).json({ error: "서버 오류가 발생했습니다"});
  }
});

app.get("/products/:id", async (req, res) => {
  const id = Number(req.params.id);

  try {
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "상품을 찾을 수 없습니다"});
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "서버 오류가 발생했습니다."});
  }
});

app.get("/users/:userId/orders/:orderId", async (req, res) => {
  const userId = Number(req.params.userId);
  const orderId = Number(req.params.orderId);

  try {
    const result = await pool.query(
      "SELECT * FROM orders WHERE order_id = $1 AND user_id = $2",
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "주문을 찾을 수 없습니다" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

app.get("/orders", authenticateToken, async (req, res) => {
  try {
    // IDOR 방어: 조회 대상 userId를 검증된 토큰(req.user)에서만 가져옴 (클라이언트 입력 신뢰 X)
    const result = await pool.query(
      "SELECT * FROM orders WHERE user_id = $1 ORDER BY order_id",
      [req.user.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

app.post("/orders", authenticateToken, async (req, res) => {
  const { product, quantity } = req.body;

  if (!product || !quantity) {
    return res.status(400).json({ error: "product, quantity는 필수입니다" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO orders (user_id, product, quantity) VALUES ($1, $2, $3) RETURNING *",
      [req.user.userId, product, quantity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

app.put("/orders/:id", authenticateToken, async (req, res) => {
  const orderId = Number(req.params.id);
  const { product, quantity } = req.body;

  if (!product || !quantity) {
    return res.status(400).json({ error: "product, quantity는 필수입니다" });
  }

  try {
    // IDOR 방어: 본인(req.user.userId) 소유의 주문만 수정 가능하도록 쿼리 조건에 user_id를 포함
    const result = await pool.query(
      "UPDATE orders SET product = $1, quantity = $2 WHERE order_id = $3 AND user_id = $4 RETURNING *",
      [product, quantity, orderId, req.user.userId]
    );

    if (result.rows.length === 0) {
      // 본인 소유가 아니거나 존재하지 않는 주문은 404 반환 (403이면 주문 존재 여부를 확인할 수 있음)
      return res.status(404).json({ error: "주문을 찾을 수 없습니다"});
    }
    res.json(result.rows[0]);
    } catch(err) {
      console.error(err);
      res.status(500).json({ error: "서버 오류가 발생했습니다"});
    }
});


app.delete("/orders/:id", async (req, res) => {
  const orderId = Number(req.params.id);

  try {
    const result = await pool.query(
      "DELETE FROM orders WHERE order_id = $1 RETURNING *",
      [orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "주문을 찾을 수 없습니다"});
    }

    res.status(204).send();
  } catch(err) {
    res.status(500).json({ error: "서버 오류가 발생했습니다."});
  }
});


app.use((req, res) => {
  res.status(404).json({ error: "요청하신 경로를 찾을 수 없습니다" });
});

app.listen(3000, () => {
  console.log('서버 실행중 http://localhost:3000')
});
