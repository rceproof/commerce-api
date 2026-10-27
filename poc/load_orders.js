import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const MAX = Number(__ENV.MAX_VUS) || 100; // 기본 100, -e MAX_VUS=N 으로 변경

// 테스트 시작 전 딱 1번 실행 - 로그인해서 토큰 확보
export function setup() {
  const res = http.post(
    `${BASE}/login`,
    JSON.stringify({ email: 'loadtest@example.com', password: 'loadtest1234#' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return { token: res.json('token') }; // 이 리턴값이 각 VU로 전달됨
}

export const options = {
  stages: [
    { duration: '30s', target: Math.round(MAX / 2) }, // 30초에 걸쳐 MAX의 절반까지 증가
    { duration: '30s', target: MAX }, // MAX까지 증가
    { duration: '1m', target: MAX }, // MAX 유지
    { duration: '30s', target: 0 }, // MAX → 0명 (쿨다운)
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% 요청이 500ms 안에
    http_req_failed: ['rate<0.01'], // 실패율 1% 미만
  },
};

// setup()의 리턴값이 data로 들어옴
export default function (data) {
  const res = http.get(`${BASE}/orders?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });

  check(res, {
    'status가 200': (r) => r.status === 200,
  });
}
