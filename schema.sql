-- 사용자
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  points INTEGER NOT NULL DEFAULT 0
);

-- 대소문자 무관 중복 방지 (함수 인덱스)
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

-- 상품
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price INTEGER NOT NULL
);

-- 주문
CREATE TABLE orders (
  order_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  product VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  product_id INTEGER,
  total INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- 상품 시드 데이터 (테스트에 필요)
INSERT INTO products (name, price) VALUES
  ('노트북', 1200000),
  ('마우스', 25000);