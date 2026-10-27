import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = 'http://localhost:3000';

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
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
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

  sleep(1);
}
