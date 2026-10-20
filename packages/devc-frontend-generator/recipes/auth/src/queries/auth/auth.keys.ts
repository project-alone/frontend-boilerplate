// auth Query Domain(OpenAPI tag `auth`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['auth'] → ['auth', <operationId>] → ['auth', <operationId>, ...인자]처럼 계층으로 만든다.
export const authKeys = {
  all: ['auth'] as const,
  getMe: () => [...authKeys.all, 'getMe'] as const,
  /** BFF의 로그인 세션(src/app/api/session/route.ts). 명세의 operation이 아니다. */
  session: () => [...authKeys.all, 'session'] as const,
}
