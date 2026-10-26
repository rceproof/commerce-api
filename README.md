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
- 배포: Docker, AWS EC2
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
- [x] 인증 / 인가 (JWT)
- [x] 결제 / 포인트 트랜잭션
- [x] 동시성 제어 (이중 결제·중복 차감 방어)
- [x] 접근 통제 (IDOR 방어 — userId + orderId 검증)
- [x] SQL 인젝션 방어 (파라미터화 쿼리)
- [x] 목록 페이지네이션 (`GET /orders`)
- [x] 의존성 취약점 관리 (npm audit, Dependabot)
- [x] 배포 (Docker, AWS EC2)

## 성능

### 주문 조회 인덱스 최적화

- **대상:** `GET /orders` — `user_id`로 본인 주문 조회
- **측정:** 주문 50만 건 기준 `EXPLAIN ANALYZE`
  - 인덱스 전: Seq Scan, 약 **8.9ms**
  - 인덱스 후(`orders_user_id_idx`): Bitmap Index Scan, 약 **0.11ms**
  - → 약 **79배** 단축
- 인덱스 정의는 `schema.sql`에 포함.

### N+1 조회 방지 설계

주문 목록에 상품명을 함께 보여줄 때, 주문마다 상품을 따로 조회하면 `1 + N`번의 쿼리(N+1 문제)가 발생한다. 이를 재현·비교해 설계를 검증했다. (`poc/n_plus_1_benchmark.js`)

- **측정:** 주문 78건을 가진 유저 기준

  | 방식                     | 쿼리 수 | 소요 시간 |
  | ------------------------ | ------- | --------- |
  | N+1 (주문마다 상품 조회) | 79번    | 24.3ms    |
  | JOIN (한 쿼리로 결합)    | 1번     | 0.9ms     |
  | 스냅샷 (현재 설계)       | 1번     | 0.7ms     |

- **선택: 스냅샷 설계** — 주문 생성 시 상품명을 `orders.product`에 저장해, 조회 시 상품 테이블을 보지 않는다.
- **이유:**
  - **성능** — 조회가 단일 쿼리로 끝나고 JOIN 비용조차 없음
  - **정확성** — 상품명·가격이 이후 변경돼도 주문은 **주문 당시의 값**을 그대로 보존 (주문 이력 왜곡 방지)
- **참고:** 위 수치는 앱·DB가 같은 로컬 환경 기준. 앱과 DB가 분리된 배포 환경에선 쿼리당 네트워크 왕복이 더해져 N+1과의 격차가 크게 벌어진다.

### 목록 페이지네이션

- `GET /orders`에 `page` / `limit` 쿼리 파라미터 지원 (기본 `page=1`, `limit=20`, `limit` 최대 100)
- `LIMIT` / `OFFSET`으로 페이지 단위 분할 → 응답 크기와 DB 부하를 낮춤
- 응답에 `total`, `totalPages` 메타데이터를 포함해 클라이언트 페이지 UI를 지원
- **참고(트레이드오프):** `OFFSET` 방식은 뒤쪽 페이지(높은 OFFSET)에서 건너뛸 행을 모두 읽어 성능이 저하됨. 트래픽 증가 시 keyset(커서) 방식으로 전환 가능.

## 보안 관리

### 의존성 취약점 패치 이력

- **2026-10-24** — `npm audit` 취약점 2건 패치
  - **body-parser** (High, GHSA-27r3-jxmh-p828): 압축 요청 본문 뒤 trailing bytes로 인한 DoS. `express.json()`이 gzip 본문을 해제하므로 실제 노출 경로가 존재해 우선 처리.
  - **ip-address** (Moderate, GHSA-rxp7-6hxx-x8q5): IPv6 파싱 2차 시간(ReDoS). 전이 의존성이며 앱에서 해당 파싱 경로를 사용하지 않아 위험은 낮으나 함께 상향.
  - 조치: `npm audit fix`(semver 호환) → 테스트 11건 통과 확인 → 재배포.
