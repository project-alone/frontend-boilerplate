// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/docker/e2e/health.spec.ts

import { expect, test } from '@playwright/test'

// 컨테이너의 HEALTHCHECK(Dockerfile)와 Kubernetes의 probe가 부르는 상태 확인 주소(src/app/api/health/route.ts)
test('상태 확인 주소는 서버가 요청을 처리하면 캐시하지 않는 200 응답을 돌려준다', async ({ request }) => {
  const response = await request.get('/api/health')

  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('no-store')
  expect(await response.json()).toEqual({ status: 'ok' })
})
