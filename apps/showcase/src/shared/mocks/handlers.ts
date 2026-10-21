// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/mocks/handlers.ts, recipes/realtime/src/shared/mocks/handlers.ts.patch, recipes/table/src/shared/mocks/handlers.ts.patch

import { deliveriesHandlers } from './deliveries'
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

// realtime Recipe: 배송 현황 목록과 이벤트 스트림을 흉내 내는 목 백엔드(deliveries.ts). 같은 요청에 명세의 example을
// 돌려주는 생성된 핸들러보다 먼저 응답하도록 앞에 넣는다. 다른 Recipe의 패치가 위 선언을 고칠 수 있으므로, 선언은 그대로
// 두고 뒤에서 넣는다.
handlers.unshift(...deliveriesHandlers)
