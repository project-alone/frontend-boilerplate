// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/mocks/node.ts

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Node.js에서 나가는 요청을 가로챈다. Vitest와 Next.js 서버(개발 서버, E2E 대상 서버)가 쓴다.
export const server = setupServer(...handlers)
