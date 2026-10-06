# Smalltalk Today — Backend

뉴스를 수집해 카테고리별(경제·테크·문화·사회·환경) 스몰토크 카드를 제공하는 서비스의 NestJS 백엔드입니다.

매일 새벽 뉴스 수집 → AI 요약·스몰토크 생성이 배치로 자동 실행되고, 프론트엔드는 카드 조회 API만 사용합니다. (수집/생성 로직과 카드 테이블 스키마는 현재 범위에 포함되어 있지 않습니다. 자세한 내용은 `CLAUDE.md` 참고.)

## 사전 준비

- Node.js v20.13.1 이상, npm
- PostgreSQL 인스턴스 (Supabase 또는 로컬 Docker)

## 설치 및 실행

```bash
cp .env.example .env
# .env를 열어 DATABASE_URL, DATABASE_SSL 등을 환경에 맞게 채운다

npm install
npm run start:dev
```

- Swagger 문서: `SWAGGER_ENABLED=true`일 때 `http://localhost:3000/api/docs`
- 헬스체크: `GET http://localhost:3000/api/health` (DB 연결 상태를 ping으로 확인)

## 환경 변수

`.env.example` 참고. 주요 변수:

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 (Supabase는 직접 연결 문자열, supabase-js 미사용) |
| `DATABASE_SSL` | `true`면 SSL 적용(Supabase 등), `false`면 미적용(로컬 Docker 등) — 기본 `true` |
| `SWAGGER_ENABLED` | Swagger 문서 노출 여부 — 기본 `false` (운영 환경에서는 꺼둘 것) |
| `ALLOWED_ORIGINS` | CORS 허용 origin 목록(콤마 구분) — 비어있으면 전체 거부 |
| `NAVER_APIHUB_KEY_ID`, `NAVER_APIHUB_KEY` | NAVER API HUB 뉴스 검색용 키 (아직 연동 안 됨) |

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run start:dev` | 개발 서버 실행 (watch) |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 검사 |
| `npm run format` | Prettier 포맷 |
| `npm run test` / `test:e2e` | 테스트 |
| `npm run migration:run` | TypeORM 마이그레이션 실행 (현재는 엔티티/마이그레이션 없음 — 스키마 확정 후 추가) |

## 범위 안내

이번 세팅은 앱 레벨 뼈대(환경변수 검증, DB 연결, 헬스체크, 전역 설정)만 포함합니다. cards/collector 등 기능 모듈, 뉴스 수집·AI 생성 로직, 테이블 스키마는 포함되어 있지 않습니다. 결정된 사항과 미정 사항은 `CLAUDE.md`를 참고하세요.
