import http from 'k6/http';
import { check, sleep } from 'k6';

// 부하 설정
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // 30초에 걸쳐 0 → 50명까지 증가
    { duration: '1m', target: 50 }, // 50명으로 1분 유지
    { duration: '30s', target: 100 }, // 50 → 100명까지 증가
    { duration: '30s', target: 0 }, // 100 → 0명 (쿨다운)
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% 요청이 500ms 안에
    http_req_failed: ['rate<0.01'], // 실패율 1% 미만
  },
};

// 각 가상 유저가 반복 실행하는 함수
export default function () {
  const res = http.get('http://localhost:3000/products');

  check(res, {
    'status가 200': (r) => r.status === 200,
  });
}
