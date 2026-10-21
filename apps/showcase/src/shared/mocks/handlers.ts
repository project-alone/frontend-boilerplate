// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/mocks/handlers.ts, recipes/infinite-list/src/shared/mocks/handlers.ts.patch, recipes/table/src/shared/mocks/handlers.ts.patch

import { articlesHandlers } from './articles'
import * as generatedMocks from '@/shared/api/generated/index.msw'
import { membersHandlers } from './members'

// MSW가 가로챌 요청과 돌려줄 응답의 목록. Vitest, Playwright, 개발 서버가 모두 이 목록을 쓴다.
// openapi.yaml에서 생성한 핸들러(src/shared/api/generated/<tag>/<tag>.msw.ts)를 모두 담으므로 명세가 바뀌어도
// 고칠 필요가 없다. 응답은 명세의 example이고, example이 없으면 faker가 스키마에 맞춰 만든다.
// 테스트 하나에서만 응답을 바꾸려면 server.use(...)를 쓴다(README의 "API 목킹").
export const handlers = [
  // table Recipe: 회원 목록의 정렬·필터·페이지를 처리하는 핸들러(members.ts). 같은 요청에 명세의 example을 돌려주는
  // 생성된 핸들러보다 먼저 응답하도록 앞에 둔다.
  ...membersHandlers,
  ...Object.values(generatedMocks).flatMap((getMockHandlers) => getMockHandlers()),
]

// infinite-list Recipe: 게시글 목록을 페이지 번호대로 나눠 돌려주는 핸들러(articles.ts). 같은 요청에 명세의 example을
// 돌려주는 생성된 핸들러보다 먼저 응답하도록 목록 맨 앞에 넣는다. 위의 목록을 고치지 않고 덧붙이므로, 같은 목록을 고치는
// 다른 Recipe(table 등)의 패치와 맥락 줄이 겹치지 않는다.
handlers.unshift(...articlesHandlers)
