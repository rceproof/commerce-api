const express = require("express");
const app = express();
const pool = require("./db");

app.use(express.json());

const orders = [];
let nextOrderId = 1;

app.get("/", (req, res) => {
  res.send("환영합니다! Commerce API 입니다");
});

app.get("/products", (req, res) => {
  res.json({
    products: [
      { id: 1, name: "노트북", price: 1200000 },
      { id: 2, name: "마우스", price: 25000 },
    ],
  });
});

app.get("/products/:id", (req, res) => {
  const id = Number(req.params.id);

  const products = [
    { id: 1, name: "노트북", price: 1200000 },
    { id: 2, name: "마우스", price: 25000 },
  ];

  const product = products.find((p) => p.id === id);

  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: "상품을 찾을 수 없습니다" });
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

app.put("/orders/:id", (req, res) => {
  const orderId = Number(req.params.id);
  const { userId, product, quantity } = req.body;

  if (!userId || !product || !quantity) {
    return res.status(400).json({ error: "userId, product, quantity는 필수입니다" });
  }

  const index = orders.findIndex((o) => o.orderId === orderId);

  if (index === -1) {
    return res.status(404).json({ error: "주문을 찾을 수 없습니다" });
  }

  orders[index] = {
    ...orders[index],
    userId,
    product,
    quantity,
  };

  res.json(orders[index]);
});


app.delete("/orders/:id", (req, res) => {
  const orderId = Number(req.params.id);

  const index = orders.findIndex((o) => o.orderId === orderId);

  if (index === -1){
    res.status(404).json({ error: "주문을 찾을 수 없습니다."});
  }

  orders.splice(index, 1);

  res.status(204).send();

});


app.use((req, res) => {
  res.status(404).json({ error: "요청하신 경로를 찾을 수 없습니다" });
});

app.listen(3000, () => {
  console.log('서버 실행중 http://localhost:3000')
});
