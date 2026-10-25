// N+1 재현,비교 PoC - 주문 목록 조회를 3가지 방식으로 측정
//  1) N+1   : 주문 1쿼리 + 주문마다 상품명 조회 N쿼리 (1+N번)
//  2) JOIN  : 주문+상품을 1쿼리로 합침
//  3) 스냅샷 : 주문행에 상품명이 이미 저장돼 있어 조회 1번 (현재 설계)
//  사용법: node poc/n_plus_1_benchmark.js

const pool = require('../db');

async function main() {
  // 주문이 가장 많은 유저 1명을 측정 대상으로 선택
  const pick = await pool.query(
    'SELECT user_id, COUNT(*) AS cnt FROM orders GROUP BY user_id ORDER BY cnt DESC LIMIT 1',
  );
  const userId = pick.rows[0].user_id;
  console.log(`대상  user_id=${userId}, 주문 ${pick.rows[0].cnt}건\n`);

  // 1) N+1: 주문 목록 1번 + 주문마다 상품명 조회
  let t = performance.now();
  const orders = (await pool.query('SELECT * FROM orders WHERE user_id = $1', [userId])).rows;
  let queries = 1;
  for (const o of orders) {
    await pool.query('SELECT name FROM products WHERE id = $1', [o.product_id]);
    queries++;
  }
  console.log(`[N+1]    쿼리 ${queries}번, ${(performance.now() - t).toFixed(1)}ms`);

  // 2) JOIN: 한 쿼리로 주문+상품명
  t = performance.now();
  await pool.query(
    'SELECT o.*, p.name AS product_name FROM orders o JOIN products p ON p.id = o.product_id WHERE o.user_id = $1',
    [userId],
  );
  console.log(`[JOIN]   쿼리 1번, ${(performance.now() - t).toFixed(1)}ms`);

  // 3) 스냅샷(현재 설계): 주문행에 상품명이 이미 있어 상품 테이블 조회 불필요
  t = performance.now();
  await pool.query('SELECT * FROM orders WHERE user_id = $1', [userId]);
  console.log(`[스냅샷] 쿼리 1번, ${(performance.now() - t).toFixed(1)}ms <- 현재 방식`);

  await pool.end();
}

main();
