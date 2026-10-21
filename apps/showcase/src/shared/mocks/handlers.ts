// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/extensions.json, recipes/file-upload/extensions.json, recipes/infinite-list/extensions.json, recipes/optimistic-update/extensions.json, recipes/table/extensions.json

import * as generatedMocks from '@/shared/api/generated/index.msw'
import { authMockHandlers } from '@/shared/auth/auth-mock-handlers'
import { articlesHandlers } from '@/shared/mocks/articles'
import { filesHandlers } from '@/shared/mocks/files'
import { membersHandlers } from '@/shared/mocks/members'
import { todosHandlers } from '@/shared/mocks/todos'

// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.
// MSW가 가로챌 요청과 돌려줄 응답의 목록. Vitest, Playwright, 개발 서버, 목 빌드가 모두 이 목록을 쓴다.
// openapi.yaml에서 생성한 핸들러(src/shared/api/generated/<tag>/<tag>.msw.ts)를 모두 담으므로 명세가 바뀌어도
// 고칠 필요가 없다. 응답은 명세의 example이고, example이 없으면 faker가 스키마에 맞춰 만든다.
// Recipe가 직접 만든 핸들러(예: 파라미터대로 거르는 목록, 발급한 토큰을 기억하는 인증)는 생성된 핸들러보다 앞에 둔다.
// MSW는 앞의 핸들러가 먼저 응답하므로, 같은 요청이면 생성된 핸들러 대신 Recipe의 핸들러가 받는다.
// 테스트 하나에서만 응답을 바꾸려면 server.use(...)를 쓴다(README의 "API 목킹").
export const handlers = [
  ...authMockHandlers,
  ...filesHandlers,
  ...articlesHandlers,
  ...todosHandlers,
  ...membersHandlers,
  ...Object.values(generatedMocks).flatMap((getMockHandlers) => getMockHandlers()),
]
