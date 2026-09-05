const express = require("express");
const app = express();

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

app.get("/orders", (req, res) => {
  res.send("주문 목록입니다");
});

app.use((req, res) => {
  res.status(404).json({ error: "요청하신 경로를 찾을 수 없습니다" });
});

app.listen(3000, () => {
  console.log('서버 실행중 http://localhost:3000')
});
