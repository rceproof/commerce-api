# Commerce API

주문·결제·포인트를 처리하는 백엔드 API 서버입니다.
웹 모의해킹 경력을 바탕으로 안전한 API 설계(SQL 인젝션 방어, 접근 통제)에 중점을 둡니다.

## 기술 스택

- Node.js
- Express
- PostgreSQL

## 개발 환경

- 런타임: Node.js (Express)
- 데이터베이스: PostgreSQL
- API 테스트: Postman
- 버전 관리: Git / GitHub
- 의존성 보안: npm audit, Dependabot

## 실행 방법

​`
node server.js
​`

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

## 보안 관리

### 의존성 취약점 패치 이력

- **2026-10-24** — `npm audit` 취약점 2건 패치
  - **body-parser** (High, GHSA-27r3-jxmh-p828): 압축 요청 본문 뒤 trailing bytes로 인한 DoS. `express.json()`이 gzip 본문을 해제하므로 실제 노출 경로가 존재해 우선 처리.
  - **ip-address** (Moderate, GHSA-rxp7-6hxx-x8q5): IPv6 파싱 2차 시간(ReDoS). 전이 의존성이며 앱에서 해당 파싱 경로를 사용하지 않아 위험은 낮으나 함께 상향.
  - 조치: `npm audit fix`(semver 호환) → 테스트 11건 통과 확인 → 재배포.
