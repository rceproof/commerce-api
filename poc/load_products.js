import http from 'k6/http';
import { check, sleep } from 'k6';

// 부하 설정
export const options = {
  vus: 10, // 가상 유저 (Virtual Users) 10명이 동시에
  duration: '30s', // 30초 동안 계속 반복
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% 요청이 500ms 안에 끝나야 통과
    http_req_failed: ['rate<0.01'], // 실패율 1% 미만이어야 통과
  },
};

// 각 가상 유저가 반복 실행하는 함수
export default function () {
  const res = http.get('http://localhost:3000/products');

  check(res, {
    'status가 200': (r) => r.status === 200,
  });

  sleep(1); // 요청 사이 1초 쉼 (실제 유저처럼)
}
