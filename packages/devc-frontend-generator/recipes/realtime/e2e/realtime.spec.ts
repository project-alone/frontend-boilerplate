import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// realtime Recipe: 빌드한 앱의 /realtime에서 배송 이벤트 스트림의 이벤트가 쿼리 캐시를 고쳐 화면이 바뀌는지 본다. 목록과
// 이벤트 스트림은 브라우저가 요청하고(server는 BFF 프록시, static-export는 백엔드 주소로 직접), MSW의 목 백엔드
// (src/shared/mocks/deliveries.ts)가 새로 연결한 화면마다 정해진 순서로 이벤트를 보낸다: 1.5초 뒤 D-1002가 배송 중으로
// 바뀌고, 2.5초 뒤 D-1004가 접수되고, 3.5초 뒤 D-1001이 배송 완료로 바뀌지만 그 이벤트를 보내기 전에 연결이 끊긴다.

/** 브라우저가 보낸 배송 목록(listDeliveries) 요청과 이벤트 스트림 요청을 모은다. */
function recordRequests(page: Page) {
  const listRequests: string[] = []
  const streamRequests: (string | undefined)[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.endsWith('/deliveries')) listRequests.push(request.url())
    if (pathname.endsWith('/deliveries/events')) streamRequests.push(request.headers()['last-event-id'])
  })
  return { listRequests, streamRequests }
}

/** 페이지에서 난 오류(예: hydration 불일치)를 모은다. */
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

/** 배송 목록에서 운송장 번호가 id인 행 */
function deliveryRow(page: Page, id: string) {
  return page.getByRole('table', { name: '배송 목록' }).getByRole('row', { name: new RegExp(id) })
}

/** 실시간 연결 상태. 다른 Recipe가 머리글에 더한 상태 문구와 섞이지 않도록 본문에서 찾는다. */
function connectionStatus(page: Page) {
  return page.getByRole('main').getByRole('status')
}

test('페이지 뼈대는 배송 없이 오고, 연결되면 실시간 이벤트가 목록을 다시 요청하지 않고 배송을 바꾸고 더한다', async ({
  page,
}) => {
  const errors = collectErrors(page)
  const { listRequests } = recordRequests(page)

  const response = await page.goto('/realtime')

  const html = (await response?.text()) ?? ''
  expect(html).toContain('배송 현황을 불러오는 중입니다.')
  expect(html).toContain('실시간 연결 중')
  expect(html).not.toContain('D-1001')
  await expect(connectionStatus(page)).toHaveText('실시간 연결됨')
  // 처음 목록을 가져오고, 연결된 뒤 연결되기 전의 변경을 맞추려고 한 번 더 가져온다.
  await expect.poll(() => listRequests.length).toBe(2)
  await expect(deliveryRow(page, 'D-1002')).toContainText('상품 준비 중')

  await expect(deliveryRow(page, 'D-1002')).toContainText('배송 중')
  await expect(page.getByRole('table', { name: '배송 목록' }).getByRole('row').nth(1)).toContainText('D-1004')

  expect(listRequests).toHaveLength(2)
  expect(errors).toEqual([])
})

test('백엔드가 연결을 끊으면 다시 연결하는 중임을 알리고, 다시 연결한 뒤 끊긴 동안 놓친 변경을 목록을 다시 가져와 맞춘다', async ({
  page,
}) => {
  const { listRequests, streamRequests } = recordRequests(page)
  await page.goto('/realtime')
  await expect(connectionStatus(page)).toHaveText('실시간 연결됨')
  await expect(deliveryRow(page, 'D-1004')).toBeVisible()
  await expect.poll(() => listRequests.length).toBe(2)

  await expect(connectionStatus(page)).toHaveText('연결이 끊겨 다시 연결하는 중')
  await expect(deliveryRow(page, 'D-1001')).toContainText('배송 중')

  await expect(connectionStatus(page)).toHaveText('실시간 연결됨')
  await expect(deliveryRow(page, 'D-1001')).toContainText('배송 완료')
  expect(listRequests).toHaveLength(3)
  // 이벤트로 받은 변경은 다시 가져온 목록에도 그대로 있다.
  await expect(deliveryRow(page, 'D-1002')).toContainText('배송 중')
  await expect(deliveryRow(page, 'D-1004')).toBeVisible()
  // 다시 연결할 때는 마지막으로 받은 이벤트 id를 보낸다.
  expect(streamRequests).toEqual([undefined, expect.any(String)])
})

// 운영체제가 다크 모드이면 다크 테마를 더하는 Recipe(dark-mode)와 함께 켠 Starter는 다크 테마로 연다. 그런 Recipe가 없으면
// 두 경우 모두 Base의 테마다.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`운영체제가 ${colorScheme} 모드이면`, () => {
    test.use({ colorScheme })

    test('실시간 배송 현황 페이지에 WCAG 2.2 AA 접근성 위반이 없다', async ({ page }) => {
      await page.goto('/realtime')
      await expect(page.getByRole('heading', { level: 1, name: '실시간 배송 현황' })).toBeVisible()
      await expect(connectionStatus(page)).toHaveText('실시간 연결됨')
      await expect(page.getByRole('table', { name: '배송 목록' })).toBeVisible()

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
      expect(violations).toEqual([])
    })
  })
}
