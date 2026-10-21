import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// 커머스 Archetype의 흐름. E2E 대상 서버의 백엔드는 커머스의 목 백엔드(src/shared/mocks/shop.ts)이고, 장바구니와 주문은 서버를
// 다시 띄울 때까지 남는다. 테스트마다 새 브라우저 문맥(localStorage)이라 장바구니도 테스트마다 새로 만든다. 목 백엔드는
// 장바구니를 바꾸는 요청에 1초 뒤에 답하고, 재고가 2개인 한정판 머그를 세 개째 담으면 늘 409로 거절한다. 그래서 응답 전에
// 바뀌는 화면(낙관적 업데이트)과 거절된 뒤의 되돌리기를 테스트만의 코드 없이 재현한다.

const T_SHIRT = { id: 1, name: '오가닉 코튼 티셔츠' }
const TOTE_BAG = { id: 4, name: '캔버스 토트백' }
const MUG = { id: 6, name: '한정판 세라믹 머그' }
const OUT_OF_STOCK = '재고가 부족합니다. 남은 수량은 2개입니다.'

/** 브라우저가 받은 장바구니 변경(담기, 수량 바꾸기) 응답의 상태 코드를 받은 순서로 모은다. 응답 전에 화면이 바뀌었는지 볼 때 쓴다. */
function recordCartSaves(page: Page): number[] {
  const statuses: number[] = []
  page.on('response', (response) => {
    const method = response.request().method()
    const { pathname } = new URL(response.url())
    if ((method === 'POST' || method === 'PATCH') && /\/carts\/[^/]+\/items(\/\d+)?$/.test(pathname)) {
      statuses.push(response.status())
    }
  })
  return statuses
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

/** 장바구니에 quantity개가 담겼을 때 장바구니 링크의 이름(보이는 수량 배지와 스크린 리더에만 읽히는 단위) */
function cartLinkName(quantity: number): RegExp {
  return new RegExp(`^장바구니\\s*${String(quantity)}\\s*개$`)
}

/** 쇼핑몰 안의 이동에 있는 장바구니 링크 */
function cartLink(page: Page) {
  return page.getByRole('navigation', { name: '쇼핑몰 화면' }).getByRole('link', { name: /^장바구니/ })
}

/** 상품 상세에서 quantity개를 장바구니에 담는다. 담았다는 상태 문구까지 기다리지 않는다. */
async function addToCart(page: Page, quantity: number) {
  // 수량 입력과 담기 버튼은 hydration이 끝나 브라우저에 둔 장바구니를 읽은 뒤에 켜진다. fill과 click은 켜질 때까지 기다리므로,
  // 미리 렌더링한 HTML에 입력한 값이 hydration 때 처음 값(1)과 섞이지 않는다(CPU가 느린 CI에서 2가 12로 바뀌던 문제).
  const input = page.getByRole('spinbutton', { name: '수량' })
  await input.fill(String(quantity))
  await page.getByRole('button', { name: '장바구니에 담기' }).click()
}

/** 상품 상세를 열어 quantity개를 담고, 담았다는 문구와 저장 응답을 기다린다. */
async function openAndAdd(page: Page, product: { id: number; name: string }, quantity: number) {
  await page.goto(`/shop/products/${String(product.id)}`)
  await addToCart(page, quantity)
  await expect(page.getByRole('status').filter({ hasText: '장바구니에 담았습니다' })).toHaveText(
    new RegExp(`${product.name} ${String(quantity)}개를 장바구니에 담았습니다`),
  )
}

/** 장바구니의 줄마다 수량(상태 문구) */
function quantityOf(page: Page, name: string) {
  return page.getByRole('group', { name: `${name} 수량` }).getByRole('status')
}

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags([...WCAG_22_AA_TAGS]).analyze()
  expect(violations).toEqual([])
}

test('상품 목록과 상세는 ISR이라 미리 렌더링한 HTML에 상품을 담아 보내고, 정한 시간마다 다시 렌더링한다', async ({
  request,
}) => {
  const list = await request.get('/shop')
  expect(list.status()).toBe(200)
  const listHtml = await list.text()
  expect(listHtml).toContain(T_SHIRT.name)
  expect(listHtml).toContain('₩19,000')
  // ISR 페이지는 revalidate(목록 300초, 상세 60초)를 공유 캐시의 수명으로 알린다.
  expect(list.headers()['cache-control']).toContain('s-maxage=300')

  const detail = await request.get(`/shop/products/${String(MUG.id)}`)
  expect(detail.status()).toBe(200)
  const detailHtml = await detail.text()
  expect(detailHtml).toContain(MUG.name)
  expect(detailHtml).toContain('남은 수량 2개')
  expect(detail.headers()['cache-control']).toContain('s-maxage=60')

  const missing = await request.get('/shop/products/999')
  expect(missing.status()).toBe(404)
  expect(await missing.text()).toContain('찾는 화면이 없습니다')
})

test('상품 탐색 → 장바구니 → 주문서 → 가짜 결제 → 주문 완료', async ({ page }) => {
  const errors = collectErrors(page)
  const saves = recordCartSaves(page)

  // 머리글의 쇼핑 링크로 상품 목록에 들어가 상품을 고른다.
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: '쇼핑' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '상품' })).toBeVisible()
  await page.getByRole('list', { name: '상품 목록' }).getByRole('link', { name: T_SHIRT.name }).click()
  await expect(page.getByRole('heading', { level: 1, name: T_SHIRT.name })).toBeVisible()

  // 장바구니가 없으면 백엔드가 장바구니를 만들어야 하므로 응답을 기다린 뒤 담겼다고 알린다.
  await addToCart(page, 2)
  await expect(page.getByRole('status').filter({ hasText: '장바구니에 담았습니다' })).toContainText(
    `${T_SHIRT.name} 2개를 장바구니에 담았습니다.`,
  )
  await expect(cartLink(page)).toHaveAccessibleName(cartLinkName(2))

  // 장바구니가 생긴 뒤에는 담으면 응답을 기다리지 않고 장바구니 수량이 늘어난다(낙관적 업데이트).
  await page.goto(`/shop/products/${String(TOTE_BAG.id)}`)
  await expect(cartLink(page)).toHaveAccessibleName(cartLinkName(2))
  saves.length = 0
  await addToCart(page, 1)
  await expect(cartLink(page)).toHaveAccessibleName(cartLinkName(3))
  expect(saves).toEqual([])
  await expect.poll(() => saves).toEqual([200])

  // 장바구니에서 수량을 늘리면 응답 전에 수량과 합계가 바뀐다.
  await cartLink(page).click()
  await expect(page.getByRole('heading', { level: 1, name: '장바구니' })).toBeVisible()
  await expect(page.getByRole('region', { name: '주문 금액' })).toContainText('₩63,000')
  saves.length = 0
  await page.getByRole('button', { name: `${T_SHIRT.name} 수량 늘리기` }).click()
  await expect(quantityOf(page, T_SHIRT.name)).toHaveText('3')
  await expect(page.getByRole('region', { name: '주문 금액' })).toContainText('₩82,000')
  expect(saves).toEqual([])
  await expect.poll(() => saves).toEqual([200])
  await expect(page.getByText('저장 중')).toBeHidden()

  // 주문서: 배송 정보 → 결제 수단 → 주문 확인
  await page.getByRole('link', { name: '주문하기' }).click()
  await expect(page.getByRole('heading', { level: 2, name: '배송 정보 (4단계 중 1단계)' })).toBeVisible()
  await page.getByRole('textbox', { name: '받는 사람' }).fill('홍길동')
  await page.getByRole('textbox', { name: '연락처' }).fill('010-1234-5678')
  await page.getByRole('textbox', { name: '우편번호' }).fill('04524')
  await page.getByRole('textbox', { name: '주소', exact: true }).fill('서울특별시 중구 세종대로 110')
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByRole('combobox', { name: '결제 수단' }).click()
  await page.getByRole('option', { name: '신용·체크카드' }).click()
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page.getByRole('heading', { level: 2, name: '주문 확인 (4단계 중 3단계)' })).toBeFocused()
  await expect(page.getByRole('table', { name: '주문 상품' })).toContainText('₩82,000')
  await page.getByRole('checkbox', { name: '주문 내용을 확인했고 결제에 동의합니다' }).click()
  await page.getByRole('button', { name: '결제하기' }).click()

  // 가짜 결제 단계: PG 연동 없는 테스트 결제창에서 승인한다.
  await expect(page).toHaveURL(/\/shop\/orders\/ORD-[\dA-F]{12}\/payment$/)
  const paymentWindow = page.getByRole('region', { name: '테스트 결제창' })
  await expect(paymentWindow).toContainText('결제 금액₩82,000')
  await expect(page.getByRole('list', { name: '주문 단계' }).locator('[aria-current="step"]')).toContainText('결제')
  await paymentWindow.getByRole('button', { name: '결제 승인' }).click()

  // 주문 완료
  await expect(page.getByRole('heading', { level: 1, name: '주문 완료' })).toBeVisible()
  await expect(page).toHaveURL(/\/shop\/orders\/ORD-[\dA-F]{12}$/)
  const orderId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
  await expect(page.getByText(`주문 번호는 ${orderId}입니다.`)).toBeVisible()
  await expect(page.getByRole('table', { name: '주문한 상품' })).toContainText(TOTE_BAG.name)
  // 결제를 마친 장바구니는 없어지고, 이 브라우저는 새 장바구니로 시작한다.
  await expect(cartLink(page)).toHaveAccessibleName('장바구니')
  await cartLink(page).click()
  await expect(page.getByText('장바구니가 비어 있습니다.')).toBeVisible()
  expect(errors).toEqual([])
})

test('백엔드가 거절하면(재고 부족) 응답 전에 늘렸던 장바구니가 되돌아가고, 무엇을 왜 되돌렸는지 알린다', async ({
  page,
}) => {
  const saves = recordCartSaves(page)
  await openAndAdd(page, MUG, 2)
  await expect(cartLink(page)).toHaveAccessibleName(cartLinkName(2))

  // 장바구니에서 수량을 늘린다: 응답 전에 3이 됐다가, 409를 받으면 2로 돌아간다.
  await cartLink(page).click()
  await expect(quantityOf(page, MUG.name)).toHaveText('2')
  saves.length = 0
  await page.getByRole('button', { name: `${MUG.name} 수량 늘리기` }).click()
  await expect(quantityOf(page, MUG.name)).toHaveText('3')
  expect(saves).toEqual([])
  await expect(quantityOf(page, MUG.name)).toHaveText('2')
  expect(saves).toEqual([409])
  const toasts = page.getByRole('region', { name: '알림' })
  await expect(toasts.getByText('수량을 바꾸지 못해 되돌렸습니다')).toBeVisible()
  await expect(toasts.getByText(`${MUG.name}: ${OUT_OF_STOCK}`)).toBeVisible()

  // 상품 상세에서 더 담아도 같다: 장바구니 수량이 응답 전에 늘었다가 되돌아간다.
  await page.goto(`/shop/products/${String(MUG.id)}`)
  await expect(cartLink(page)).toHaveAccessibleName(cartLinkName(2))
  saves.length = 0
  await addToCart(page, 1)
  await expect(cartLink(page)).toHaveAccessibleName(cartLinkName(3))
  expect(saves).toEqual([])
  await expect(cartLink(page)).toHaveAccessibleName(cartLinkName(2))
  expect(saves).toEqual([409])
  await expect(toasts.getByText('장바구니에 담지 못했습니다')).toBeVisible()
})

// 운영체제가 다크 모드이면 다크 테마를 더하는 Recipe(dark-mode)와 함께 켠 Starter는 다크 테마로 연다. 그런 Recipe가 없으면
// 두 경우 모두 Base의 테마다.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`운영체제가 ${colorScheme} 모드이면`, () => {
    test.use({ colorScheme })

    test('쇼핑몰의 모든 화면(목록, 상세, 장바구니, 주문서의 오류, 결제창, 주문 완료)에 WCAG 2.2 AA 접근성 위반이 없다', async ({
      page,
    }) => {
      await page.goto('/shop')
      await expect(page.getByRole('list', { name: '상품 목록' })).toBeVisible()
      await expectNoAxeViolations(page)

      await openAndAdd(page, T_SHIRT, 1)
      await expectNoAxeViolations(page)

      await cartLink(page).click()
      await expect(quantityOf(page, T_SHIRT.name)).toHaveText('1')
      await expectNoAxeViolations(page)

      await page.getByRole('link', { name: '주문하기' }).click()
      await page.getByRole('button', { name: '다음' }).click()
      await expect(page.getByRole('textbox', { name: '받는 사람' })).toBeFocused()
      await expectNoAxeViolations(page)

      await page.getByRole('textbox', { name: '받는 사람' }).fill('홍길동')
      await page.getByRole('textbox', { name: '연락처' }).fill('010-1234-5678')
      await page.getByRole('textbox', { name: '우편번호' }).fill('04524')
      await page.getByRole('textbox', { name: '주소', exact: true }).fill('서울특별시 중구 세종대로 110')
      await page.getByRole('button', { name: '다음' }).click()
      await page.getByRole('combobox', { name: '결제 수단' }).click()
      await page.getByRole('option', { name: '계좌이체' }).click()
      await page.getByRole('button', { name: '다음' }).click()
      await expect(page.getByRole('table', { name: '주문 상품' })).toBeVisible()
      await expectNoAxeViolations(page)

      await page.getByRole('checkbox', { name: '주문 내용을 확인했고 결제에 동의합니다' }).click()
      await page.getByRole('button', { name: '결제하기' }).click()
      await expect(page.getByRole('region', { name: '테스트 결제창' })).toBeVisible()
      await expectNoAxeViolations(page)

      await page.getByRole('button', { name: '결제 승인' }).click()
      await expect(page.getByRole('heading', { level: 1, name: '주문 완료' })).toBeVisible()
      await expectNoAxeViolations(page)
    })
  })
}
