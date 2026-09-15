const express = require("express");
const app = express();
const pool = require("./db");
const bcrypt = require("bcrypt");

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

app.get("/orders", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM orders ORDER BY order_id");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

app.post("/orders", async (req, res) => {
  const { userId, product, quantity } = req.body;

  if (!userId || !product || !quantity) {
    return res.status(400).json({ error: "userId, product, quantity는 필수입니다" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO orders (user_id, product, quantity) VALUES ($1, $2, $3) RETURNING *",
      [userId, product, quantity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
});

app.put("/orders/:id", async (req, res) => {
  const orderId = Number(req.params.id);
  const { userId, product, quantity } = req.body;

  if (!userId || !product || !quantity) {
    return res.status(400).json({ error: "userId, product, quantity는 필수입니다" });
  }

  try {
    const result = await pool.query(
      "UPDATE orders SET user_id = $1, product = $2, quantity = $3 WHERE order_id = $4 RETURNING *",
      [userId, product, quantity, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "주문을 찾을 수 없습니다"});
    }
    res.json(result.rows[0]);
    } catch(err) {
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
