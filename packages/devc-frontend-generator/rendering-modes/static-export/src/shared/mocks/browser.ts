import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// 브라우저에서 나가는 요청을 서비스 워커(public/mockServiceWorker.js)로 가로챈다.
// NEXT_PUBLIC_API_MOCKING=enabled로 만든 빌드(개발 서버, E2E)에서 browser-instrumentation.ts가 켠다.
export const worker = setupWorker(...handlers)
