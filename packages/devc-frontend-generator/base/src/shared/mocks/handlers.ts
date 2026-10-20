import * as generatedMocks from '@/shared/api/generated/index.msw'

// MSW가 가로챌 요청과 돌려줄 응답의 목록. Vitest, Playwright, 개발 서버가 모두 이 목록을 쓴다.
// openapi.yaml에서 생성한 핸들러(src/shared/api/generated/<tag>/<tag>.msw.ts)를 모두 담으므로 명세가 바뀌어도
// 고칠 필요가 없다. 응답은 명세의 example이고, example이 없으면 faker가 스키마에 맞춰 만든다.
// 테스트 하나에서만 응답을 바꾸려면 server.use(...)를 쓴다(README의 "API 목킹").
export const handlers = Object.values(generatedMocks).flatMap((getMockHandlers) => getMockHandlers())
