# CLAUDE.md

이 파일은 AI 어시스턴트(Claude 등)가 이 리포지토리에서 작업할 때 참고하는 결정 사항/미정 사항 기록입니다.

## 작업 규칙

- 이 프로젝트에서 AI 어시스턴트와 작업할 때 질문, 선택지, 계획 설명은 모두 **한국어**로 작성한다.
- **제품 요구사항의 기준은 [`docs/PRD.md`](docs/PRD.md)다.** 작업 전에 반드시 읽고, 기존 코드나 이 파일의 내용이 PRD와 충돌하면 PRD를 따른다. 단, 충돌을 발견하면 임의로 코드를 고치기 전에 사용자에게 알린다.
- 2026-11-19에 PRD 기준으로 설계를 처음부터 다시 잡기로 했다. 그 이전에 만든 코드(`src/news/`, `src/cards/`, `src/database/entities/`, 마이그레이션 등)는 **참고용 초안**이며, PRD와 맞지 않는 부분은 재설계 대상이다.
- PRD에 없거나 PRD가 모호한 부분은 아래 "미정 사항"에 적고, 임의로 결정하지 말고 사용자에게 묻는다.

## 프로젝트 개요

Smalltalk Today — 오늘의 뉴스를 20-30대 직장인이 바로 쓸 수 있는 스몰토크 문장으로 바꿔주는 웹앱(MVP). 이 리포지토리는 백엔드다. 상세 요구사항은 `docs/PRD.md`.

일일 파이프라인 요약 (KST, 휴일 포함 매일):
- **06:00** 수집: 카테고리별 고정 검색어로 네이버 뉴스 API 수집(제목·발췌문·링크만, 본문 크롤링 금지, 범위 전날 06:00 ~ 당일 06:00) → 제목에서 후보 키워드 추출 → 데이터랩으로 검색량 순위 산정 → AI 사실 추출·카테고리 분류·랭킹 헤드라인 작성 → 구글 시트 업로드 (07:00 전 완료)
- **07:00** 사람이 구글 시트에서 사실·헤드라인·카테고리 검수
- **08:00 전** 승인된 사실만 가져와 AI로 3줄 요약 + 스몰토크 표현 4개 생성, 관련 기사(최대 3건) 구성 → **08:00 오픈**. 08:00 전 접속 시 전날 콘텐츠 표시
- 사용자 요청 시 실시간 AI 생성 없음(다른 표현·다른 이슈는 모두 미리 만든 것으로 교체)

## 결정된 사항

### PRD에서 온 결정

- **카테고리**: 경제·테크·문화·사회·환경 5개.
- **카드 구성**: 카테고리마다 검색량 1위 = Today Pick 카드, 2~4위 = 예비 이슈 3개(다 쓰면 처음으로 순환). 카드 이슈는 하루 20개.
- **카드 내용**: 3줄 요약(한 줄 40자 안쪽), 스몰토크 표현 4개(기본 1 + 다른 표현 3, 부드러운 존댓말·2줄 이내·브랜드 홍보 금지), 관련 기사 최대 3건(사용된 승인 사실이 많은 기사 순, 같으면 최신 발행 순; 기사 제목·원문 링크·발행 시각).
- **제외 주제**: 정치, 종교, 젠더, 혐오, 사건·사고(사망, 범죄, 재난).
- **AI 호출 분리**: 사실 추출(+카테고리 분류, 랭킹 헤드라인)과 요약·스몰토크 생성은 별도 호출. 생성 단계에는 사람이 승인한 사실만 전달.
- **랭킹**: 네이버 데이터랩 검색어트렌드 API, 하루 1회 갱신.
  - **순위 기준 = 어제 검색량 (PRD 방식, 2026-11-19 확정)**: `search_score` = 이슈의 어제 ratio ÷ 같은 요청 안 **공통 기준 키워드**의 어제 ratio. 데이터랩은 요청 단위 상대값(최대 100)이라 모든 요청에 같은 기준 키워드를 넣어 비교한다. 기준 키워드는 1개, 기본값 `날씨`(`src/config/ranking.config.ts`의 `anchorKeyword`, 실제 값을 보고 교체). 요청당 이슈 4개 + 기준 1개. 동점이면 언론사 수 순, 점수 없음(조회 실패·기준 값 0)은 뒤로. 급상승도 방식은 폐기.
  - **랭킹 범위는 PRD와 다르게 카드 이슈 20개 안에서 상위 15개 (2026-11-19 사용자 결정)**: 1~10위 TOP 10, 11~15위 예비. 랭킹 전용 카드는 만들지 않으므로 검수량은 최대 20건. PRD 문서 수정은 팀이 정한다.
  - 후보 이슈 선정(데이터랩 이전 단계): 주요 언론사 2곳 이상 보도 + 제외·시황 표시 없는 묶음 중 카테고리별 언론사 수 상위 10개.
- **사실 검수 도구**: 구글 시트(AI 추출 결과 업로드 → 승인·수정된 사실만 다시 가져옴). 고정 검색어 목록·변경 이력도 시트의 '검색어 목록' 탭에서 관리.
- **문장 저장**: 프론트엔드 localStorage(최대 50개). 백엔드 저장 없음, 로그인 없음.
- **기사 발췌문**: `articles.description`에 저장하되 **최대 7일 보관**. 7일이 지나면 발췌문만 NULL로 지우고 기사 행(제목·링크·발행 시각)은 남긴다(지난 카드의 관련 기사 유지). 삭제 실행 방식은 미정(아래 참고).

### 테이블 (2026-11-19 재설계, 로컬 Docker DB 우선 → 구현 완료 후 Supabase 이전)

엔티티는 `src/database/entities/`, 상태값 상수는 `constants.ts`.
- `daily_runs`: 하루 실행 단위(PK `run_date` = 수집 기간 끝의 KST 날짜). `status`(collecting→extracted→reviewing→generated→published), `published_at`이 있어야 노출 — 08시 전에는 전날 실행분을 보여준다.
- `articles`: 수집 기사. `url` UNIQUE, `description`은 nullable(7일 후 NULL).
- `issues`: 이슈(기사 묶음). 랭킹 후보 전부(카테고리별 최대 10개)를 저장. `category_rank` 1 = Today Pick, 2~4 = 예비, 순위 밖은 NULL. `overall_rank` 1~10 = 랭킹 TOP 10, 11~15 = 랭킹 예비(카드 이슈 안에서만). `search_score`(어제 검색량 점수), `headline`, `review_status`. 카테고리는 ②에서 수집 검색어 기준 임시값 → ③에서 AI 분류·검수로 확정.
- `issue_articles`: 이슈↔기사 N:M.
- `facts`: AI 추출 사실(`ai_text`), 검수 수정본(`reviewed_text`), `status`. 출처 기사(`article_id`)를 가짐.
- `cards`: 이슈와 1:1(`issue_id` UNIQUE) → 카테고리 카드와 랭킹 카드가 같은 이슈면 자동으로 같은 카드. `summary`(1~3줄), `expressions`(4개, 0번이 기본).
- `card_articles`: 카드의 관련 기사, `position` 1~3.
- **랭킹·카드 응답**: 첫 화면은 사전 생성된 콘텐츠를 조회만 하므로 3초 이내 표시가 목표.

### 기술 기반 (PRD 이전 결정, 유지)

- **프레임워크**: NestJS
- **DB**: Supabase(PostgreSQL). `supabase-js`는 사용하지 않고 PostgreSQL 연결 문자열로 직접 연결.
- **DB 연결 도구**: TypeORM (`@nestjs/typeorm` + `typeorm` + `pg`).
- **로컬 DB**: Docker 컨테이너 `smalltalk-db`(postgres:16, 호스트 포트 5433).
- **DB SSL**: `DATABASE_SSL` 환경변수(boolean, 기본 `true`)로 on/off. true면 `ssl: { rejectUnauthorized: false }`, false면 ssl 미적용. `database.module.ts`와 `data-source.ts` 양쪽에 동일 적용.
- **마이그레이션**: TypeORM 마이그레이션만 사용, `synchronize: false` 항상 유지(운영 DB 자동 동기화 금지).
- **네이버 API**: NAVER API HUB(`naverapihub.apigw.ntruss.com`), 헤더 `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY`, 환경변수 `NAVER_APIHUB_KEY_ID` / `NAVER_APIHUB_KEY`. 뉴스 검색은 `/search/v1/news`.
- **AI 모델**: Google Gemini 무료 등급, `gemini-3.8-flash` (REST `generateContent` 직접 호출, SDK 미사용). 환경변수 `GOOGLE_API_KEY`, 모델 변경은 `GEMINI_MODEL`. 무료 등급 분당 한도를 고려한 요청 간격 필요.
- **전역 설정**: `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, Global Prefix `/api`.
- **Swagger**: `SWAGGER_ENABLED` 환경변수로 on/off, **코드 기본값은 `false`**. `/api/docs`에 마운트.
- **CORS**: 허용 origin은 `ALLOWED_ORIGINS` 환경변수(콤마 구분). 비어있으면 **기본 전체 거부**(origin: false). `credentials` 미사용.
- **헬스체크**: `GET /api/health` — `@nestjs/terminus`의 `TypeOrmHealthIndicator`로 실제 DB 핑.
- **브랜치 전략** (정보용): `feature/*` → `dev`(squash) → `main`(merge commit).

### 폐기된 결정 (PRD와 충돌)

- ~~`POST /cards/:id/regenerate`(실시간 재생성)~~ → PRD상 실시간 생성 없음. 미리 만든 표현·예비 이슈로 교체.
- ~~스몰토크 3개, 카테고리별 최대 5개 이슈, 전체 이슈를 Gemini 1회 호출로 생성~~ → 표현 4개, 카테고리별 4개 이슈(1 + 예비 3), 사실 추출/생성 호출 분리.
- ~~기존 테이블 초안(`cards`/`articles`/`card_articles`, 2026-11-18), `CardStoreService`, `POST /api/v1/dev/issue-cards/save`~~ → 위 "테이블"로 재설계, 마이그레이션도 새로 생성. 카드 저장은 ④ 생성 단계에서 다시 구현.

## 일일 실행 단계 구현 현황

- **② 수집 + 랭킹** (`src/runs/`): `CollectRunService.collect({ date?, force? })` → `TrendIssuesService.collectAndRank` → DB 저장(트랜잭션 하나, `daily_runs.status='collecting'`). 같은 날짜가 있으면 409, `force: true`면 그날 이슈·사실·카드를 지우고 다시 만든다(기사는 URL로 재사용). 개발용 `POST /api/v1/dev/runs/collect`(`NODE_ENV=development`에서만 등록, 스케줄러 결정 전 수동 실행용).
- 기준 키워드 후보 비교: 개발용 `POST /api/v1/dev/datalab-test`에 `anchor`를 바꿔 넣어 본다.

## 재설계 진행 순서 (2026-11-19 합의)

① DB 스키마 → ② 수집 + 랭킹 → ③ 사실 추출 + 구글 시트 → ④ 승인 사실로 생성 → ⑤ 공개 조회 API. 단계별로 하나씩 진행하고, **코드 수정 전에는 변경 계획을 먼저 사용자에게 승인받는다.**

## 미정 사항 (TBD — 임의로 결정하지 말 것)

- **발췌문 7일 삭제 실행 방식**: 스케줄러 방식이 유력하지만 **코드 설계 보류, 추후 다시 설계**. 스케줄러 방식 결정과 함께 정한다. 그 전까지 삭제 코드를 만들지 말 것.
- **반복 방지 판정 기준**: "최근"의 기간과 "새 전개"를 어떻게 판단할지.
- **구글 시트 연동 방식**: 인증(서비스 계정 등), 시트 구조(탭·열), 검수 완료를 어떻게 감지할지(08:00 정각 일괄 가져오기 vs 완료 표시 후 트리거).
- **데이터랩 산정 세부**: 공통 기준 키워드 선택, 요청당 키워드 묶음 크기, 후보 키워드 추출 방법.
- **공개 API 형태**: 오늘 카드·랭킹 조회 엔드포인트 구조(PRD 기준으로 새로 설계).
- **스케줄러 방식**: 서버 내부(`@nestjs/schedule`) vs GitHub Actions.
- **배포 플랫폼**.
- **Supabase 연결 모드**: direct connection(5432) vs transaction-mode pooler(6543) — 배포 플랫폼이 서버리스로 정해지면 재검토(TypeORM의 extended query protocol은 pooler와 충돌할 수 있음).
- 외부에서 호출 가능한 내부 API(파이프라인 수동 실행 등)를 추가하게 되면, 배포 전 **비밀 키 가드 필수**.
