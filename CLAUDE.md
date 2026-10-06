# CLAUDE.md

이 파일은 AI 어시스턴트(Claude 등)가 이 리포지토리에서 작업할 때 참고하는 결정 사항/미정 사항 기록입니다.

## 작업 규칙

- 이 프로젝트에서 AI 어시스턴트와 작업할 때 질문, 선택지, 계획 설명은 모두 **한국어**로 작성한다.

## 프로젝트 개요

Smalltalk Today — 뉴스를 수집해 카테고리별(경제·테크·문화·사회·환경) 스몰토크 카드를 제공하는 서비스. 매일 새벽 뉴스 수집 → AI 요약·스몰토크 생성을 자동 실행하고, 프론트엔드는 카드 조회 API만 사용한다.

## 결정된 사항

- **프레임워크**: NestJS
- **DB**: Supabase(PostgreSQL). `supabase-js`는 사용하지 않고 PostgreSQL 연결 문자열로 직접 연결.
- **DB 연결 도구**: TypeORM (`@nestjs/typeorm` + `typeorm` + `pg`). jsonb/timestamptz 컬럼 타입과 `@Check()` 데코레이터로 CHECK 제약을 엔티티 자체에 선언할 수 있다는 점, `@nestjs/typeorm`의 Nest 공식 통합을 기준으로 Prisma/Drizzle/raw pg 대비 채택. 현재는 **연결 레이어만** 구성되어 있고 엔티티/테이블은 아직 없음(아래 미정 사항 참고).
- **테이블**: `cards`, `articles` (snake_case, 시간 컬럼은 timestamptz, summary는 jsonb) — 단, 구체적인 컬럼/제약/관계는 아직 미정(아래 참고).
- **DB SSL**: `DATABASE_SSL` 환경변수(boolean, 기본 `true`)로 on/off. true면 `ssl: { rejectUnauthorized: false }` 적용(Supabase 등), false면 ssl 미적용(로컬 Docker PostgreSQL 등). `database.module.ts`와 `data-source.ts` 양쪽에 동일 적용.
- **마이그레이션**: TypeORM 마이그레이션만 사용, `synchronize: false` 항상 유지(운영 DB 자동 동기화 금지).
- **뉴스 소스**: NAVER API HUB 뉴스 검색(`https://naverapihub.apigw.ntruss.com/search/v1/news`), 헤더 `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`. 환경변수명은 `NAVER_APIHUB_KEY_ID` / `NAVER_APIHUB_KEY` (아직 연동 로직 없음, placeholder만 존재).
- **공개 API** (Global Prefix: `/api`):
  - `GET /cards?date=&category=`
  - `POST /cards/:id/regenerate` ← 구현 시 요청 횟수 제한 필수(아직 미구현)
- **전역 설정**: `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, Global Prefix `/api`.
- **Swagger**: `SWAGGER_ENABLED` 환경변수로 on/off, **코드 기본값은 `false`**(운영 환경 안전 기본값). `/api/docs`에 마운트.
- **CORS**: 허용 origin은 `ALLOWED_ORIGINS` 환경변수(콤마 구분)로 설정. 비어있으면 **기본 전체 거부**(origin: false). `credentials`는 사용하지 않음(로그인/쿠키 없음).
- **헬스체크**: `GET /api/health` — `@nestjs/terminus`의 `TypeOrmHealthIndicator`로 실제 DB 핑(정적 응답 아님).
- **브랜치 전략** (정보용): `feature/*` → `dev`(squash) → `main`(merge commit).

## 미정 사항 (TBD — 임의로 결정하지 말 것)

- **테이블 스키마**: `cards`/`articles`의 구체적인 컬럼, 타입, CHECK 제약, 테이블 간 관계(1카드:N기사 여부 등) — 팀과 재논의 후 확정.
- **스케줄러 방식**: 서버 내부(`@nestjs/schedule`) vs GitHub Actions.
- **배포 플랫폼**.
- **Supabase 연결 모드**: direct connection(5432) vs transaction-mode pooler(6543) — 배포 플랫폼이 서버리스로 정해지면 재검토 필요(TypeORM이 의존하는 extended query protocol은 pooler와 충돌할 수 있음).
- 외부에서 호출 가능한 내부 API를 추가하게 되면, 배포 전 **비밀 키 가드 필수**.
