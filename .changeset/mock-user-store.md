---
'devc-frontend-generator': patch
---

대시보드 Archetype에서 바꾼 사용자의 역할이 auth Recipe의 목 계정에 반영되지 않아, 목 환경에서 관리자 권한을 뺀 계정으로 다시 로그인해도 관리자로 동작하던 문제를 고친다. 실제 백엔드처럼 목 사용자 저장소를 하나만 둔다. auth의 목 백엔드(`src/shared/auth/auth-mock-handlers.ts`)가 사용자 저장소(`mockUsers()`, `saveMockUser(user)`, `resetMockUsers(seed)`)를 내보내고 로그인, refresh, `getMe`, `mockUserOf`가 모두 그 저장소를 보며, 대시보드의 목 백엔드(`src/shared/mocks/users.ts`)는 사용자의 이름·이메일·역할을 사본 없이 그 저장소에 두고 상태·부서·추가한 날만 따로 기억한다. 그래서 대시보드의 사용자와 추가한 사용자도 목 비밀번호로 로그인하고, 바꾼 역할은 목 백엔드가 다음 요청부터 401·403 판단에 쓰며 로그인 세션에는 다음 로그인이나 refresh부터 담긴다. auth에 저장소 테스트(`auth-mock-handlers.test.ts`)를, 대시보드에 역할을 바꾼 계정이 다시 로그인하면 바뀐 역할로 동작하는지 보는 단위 테스트와 E2E를 더한다.
