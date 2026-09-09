const express = require("express");
const app = express();

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

app.get("/users/:userId/orders/:orderId", (req, res) => {
  const userId = Number(req.params.userId);
  const orderId = Number(req.params.orderId);

  const order = orders.find(
    (o) => o.userId === userId && o.orderId === orderId
  );

  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ error: "주문을 찾을 수 없습니다" });
  }
});

app.get("/orders", (req, res) => {
  res.json(orders);
});

app.post("/orders", (req, res) => {
  const { userId, product, quantity } = req.body;

  if (!userId || !product || !quantity) {
    return res.status(400).json({ error: "userId, product, quantity는 필수입니다" });
  }

  const order = {
    orderId: nextOrderId++,
    userId,
    product,
    quantity,
    createdAt: new Date(),
  };

  orders.push(order);
  res.status(201).json(order);
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
