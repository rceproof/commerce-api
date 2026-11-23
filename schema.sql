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

-- 주문 조회 성능: user_id 인덱스 (GET /orders)
CREATE INDEX orders_user_id_idx ON orders (user_id);

-- 상품 시드 데이터 (테스트에 필요)
INSERT INTO products (name, price) VALUES
  ('노트북', 1200000),
  ('마우스', 25000);

  -- 결제 (한 주문에 결제 시도가 여러 번 생길 수 있어 orders와 분리)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),    -- 어느 주문의 결제인지
  order_uid VARCHAR(64) NOT NULL UNIQUE,                    -- 토스 주문번호 (결제 시도마다 발급하는 추측 불가 랜덤 문자열)
  amount INTEGER NOT NULL CHECK (amount > 0),               -- 결제 금액 (승인 때 orders.total·토스 금액과 대조)
  payment_key VARCHAR(200) UNIQUE,                          -- 토스 승인 후 받는 결제 키 (멱등성 키)
  status VARCHAR(20) NOT NULL DEFAULT 'READY' CHECK (status IN ('READY','DONE','CANCELED','FAILED')), -- READY → DONE / CANCELED / FAILED
  created_at TIMESTAMP DEFAULT now(),
  approved_at TIMESTAMP
);

CREATE INDEX payments_order_id_idx ON payments (order_id);