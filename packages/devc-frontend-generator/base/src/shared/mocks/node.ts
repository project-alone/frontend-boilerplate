import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Node.js에서 나가는 요청을 가로챈다. Vitest와 Next.js 서버(개발 서버, E2E 대상 서버)가 쓴다.
export const server = setupServer(...handlers)
