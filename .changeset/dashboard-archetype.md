---
'devc-frontend-generator': minor
---

`dcgen new --archetype <이름>`과 터미널의 Archetype 선택을 더하고, 첫 Archetype으로 관리자 대시보드(`dashboard`, `server`)를 더한다. Archetype은 Recipe와 같은 overlay 형식에 쓰는 Recipe와 (좁힐 때만) Rendering Mode를 적은 `archetype.json`을 더한 것으로, 고르면 쓰는 Recipe가 알림과 함께 들어가고, 지원하지 않는 Rendering Mode와는 만들기 전에 이유와 함께 거부되며, Recipe를 모두 덧입힌 뒤에 덧입힌다. 대시보드는 `auth`, `chart`, `table` Recipe를 써서 로그인한 사용자의 사용자 통계와 차트(`/dashboard`), 정렬·필터가 되는 사용자 목록, 관리자만 들어가는 사용자 추가·수정 폼을 제공하고, 명세 조각으로 tag `users`의 operation을 더한다. Query Domain은 `npm run g`로 만든 코드 그대로이고, 추가·수정한 사용자를 기억하고 실제 백엔드처럼 accessToken으로 로그인(401)과 관리자 역할(403)을 확인하는 목 백엔드, 401·403을 받으면 알리고 접근 규칙을 서버에서 다시 확인하는 폼, 컴포넌트 테스트, 스토리, E2E(로그인 → 통계 확인 → 사용자 추가 → 목록 반영, 역할, 백엔드의 401·403)가 함께 들어간다. auth Recipe의 보호된 라우트 규칙은 `[userId]` 같은 동적 세그먼트를 받고, auth의 목 백엔드는 요청한 사용자를 알려 주는 `mockUserOf`를, Vitest에서 목 계정으로 로그인한 요청을 만드는 `signInAsMockUser`(`src/shared/auth/mock-session.ts`)를 더한다.
