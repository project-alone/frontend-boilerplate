// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/api/api-instrumentation.ts

import { backendBaseUrl } from './base-url'

/**
 * Next.js 서버가 뜰 때 한 번 실행된다(src/instrumentation.ts가 부른다).
 * API_MOCKING=enabled이면 서버 컴포넌트와 Route Handler가 보내는 요청을 MSW가 받는다.
 * 개발 서버는 .env.development에서, E2E 대상 서버는 config/playwright.config.ts에서 이 값을 켠다.
 * 실제로 배포하는 서버에서는 켜지 않는다(msw는 devDependency다).
 * next build에서는 Next.js가 instrumentation을 실행하지 않으므로, 목 빌드에서는 apiFetch가 MSW를 켠다(api-mocking.ts).
 */
export const apiInstrumentation = {
  async register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    if (process.env.API_MOCKING === 'enabled') {
      const { startApiMocking } = await import('./api-mocking')
      await startApiMocking()
      return
    }

    // MSW를 끈 서버는 API_BASE_URL의 백엔드를 부른다. 주소가 없으면 backendBaseUrl()이 여기서 실패해, 서버가
    // 요청을 처리하지 않고 무엇을 넣어야 하는지 알린다.
    backendBaseUrl()
  },
}
