# API Manager

API를 테스트하고 저장·조회하고, 사이트 URL로 엔드포인트를 자동 분석하는 개인용 도구.

## 스택
- **React + Vite** — SPA 프론트엔드
- **Firebase** — Google OAuth 로그인 + Firestore (저장된 요청 / API 키 보관)
- **Cloudflare Worker** — CORS-free 요청 프록시 + URL 분석 엔진
- **Cloudflare** — DNS / 배포

## 기능
- 🧪 **테스터**: 메서드·URL·쿼리·헤더·바디로 요청 작성 → 프록시 통해 전송 → 응답(상태/시간/크기/헤더/본문) 확인. cURL 복사·응답 복사 지원
- 📁 **저장된 API**: 요청을 Firestore에 저장하고 목록에서 검색·불러오기·삭제
- 🔑 **API 키**: 외부 API 인증정보를 보관하고, 요청에 자동 주입 (Bearer / 커스텀 헤더 / 쿼리)
- 🍪 **세션(도메인 단위)**: 로그인 쿠키를 도메인별로 저장 → 테스터에서 요청 도메인에 맞는 세션을 **자동 적용**. 응답의 Set-Cookie로 바로 세션 생성 가능
- 🔍 **URL 분석**: OpenAPI·Swagger 스펙, GraphQL 인트로스펙션, JS 번들 내 fetch/axios 호출을 탐지해 엔드포인트 추출. 로그인 사이트는 인라인 쿠키로 인증 분석

## 설정

### 1. Firebase
1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Authentication → Sign-in method → Google** 활성화
3. **Firestore Database** 생성 (프로덕션 모드)
4. **프로젝트 설정 → 일반 → 내 앱(웹)** 에서 SDK 설정값 확인
5. `.env.example`를 `.env`로 복사 후 값 채우기

```bash
cp .env.example .env
```

`VITE_ALLOWED_EMAILS`에 본인 이메일만 넣으면 다른 Google 계정 로그인을 차단합니다.

### 2. Firestore 보안 규칙
사용자별로 자기 데이터만 접근하도록:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### 3. Cloudflare Worker (프록시 + 분석)
프로덕션에서는 `api.sanghak.kr/proxy`, `api.sanghak.kr/analyze`를 Worker 라우트가 처리합니다
(`wrangler.toml`의 `routes`). 따라서 프론트의 `VITE_WORKER_BASE`는 비워둡니다(same-origin).

## 개발
```bash
npm install
npm run worker:dev   # 터미널 1 — 프록시/분석 Worker (:8787)
npm run dev          # 터미널 2 — Vite (:5173)
```
로컬에서는 Vite가 `/proxy`·`/analyze`를 `localhost:8787`로 포워딩합니다.

## 배포

### 프론트엔드 → GitHub Pages (`api.sanghak.kr`)
`main`에 push하면 `.github/workflows/deploy.yml`이 빌드 후 GitHub Pages로 배포합니다.
커스텀 도메인은 `public/CNAME`(api.sanghak.kr)로 유지됩니다. 별도 시크릿 불필요.

### 프록시/분석 → Cloudflare Worker (workers.dev)
별도 백엔드. 코드 변경 시 수동 배포:
```bash
npm run worker:deploy   # → https://api-manager-proxy.totoriverce.workers.dev
```
프론트는 빌드 시 `VITE_WORKER_BASE`(워크플로에 설정)로 이 Worker를 cross-origin 호출하며,
Worker가 CORS를 처리합니다.

### 1회 수동 설정
- **Firebase Authentication → Settings → 승인된 도메인**에 `api.sanghak.kr` 추가 (Google 로그인 팝업 허용)
- **Firestore 보안 규칙** 게시 (위 2번 항목)

## 데이터 구조 (Firestore)
```
users/{uid}/requests/{id}   { name, method, url, headers[], params[], body, keyId, createdAt, updatedAt }
users/{uid}/apikeys/{id}    { name, value, location, headerName, queryName, template }
```
