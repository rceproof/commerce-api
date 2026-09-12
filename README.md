# Commerce API

주문·결제·포인트를 처리하는 백엔드 API 서버입니다.
웹 모의해킹 경력을 바탕으로 안전한 API 설계(SQL 인젝션 방어, 접근 통제)에 중점을 둡니다.

## 기술 스택

- Node.js
- Express
- PostgreSQL

## 실행 방법

​```
node server.js
​```

실행 후 http://localhost:3000 접속

## 구현 현황

- [x] Express 기반 REST API
- [x] 주문 CRUD (생성 / 조회 / 수정 / 삭제)
- [x] PostgreSQL 연동
- [x] 접근 통제 (IDOR 방어 — userId + orderId 검증)
- [x] SQL 인젝션 방어 (파라미터화 쿼리)
- [x] 의존성 취약점 관리 (npm audit, Dependabot)
- [ ] 인증 / 인가 (JWT)
- [ ] 결제 / 포인트 트랜잭션
- [ ] 동시성 제어 (이중 결제·중복 차감 방어)
- [ ] 배포 (Docker, AWS)