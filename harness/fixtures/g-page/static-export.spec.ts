import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// 하네스(harness/g-page.test.ts)가 query → mutation → form → page Schematic을 차례로 실행해 만든 화면을, 브라우저의 MSW를 켜고
// 빌드한 static-export Starter에서 검사한다. 상품은 하네스가 바꾼 MSW 핸들러(src/shared/mocks/handlers.ts)가 페이지를 연
// 브라우저의 메모리에 둔다.
const PRODUCT_NAMES = ['기본 티셔츠', '데님 재킷']
const LOADING_MESSAGE = '불러오는 중입니다.'

/** 상품 등록 폼(createProduct)에 값을 넣어 제출하고 성공 알림을 기다린다. */
async function registerProduct(page: Page, name: string) {
  await page.getByRole('textbox', { name: 'name' }).fill(name)
  await page.getByRole('spinbutton', { name: 'price' }).fill('1000')
  await page.getByRole('button', { name: '상품 등록' }).click()
  await expect(page.getByText('상품 등록 완료')).toBeVisible()
}

test('목록과 폼을 함께 둔 CSR 페이지는 브라우저가 가져온 목록을 보여 주고, 폼을 제출하면 목록을 다시 가져와 새 상품을 보여 준다', async ({
  page,
}) => {
  const name = `새 상품 ${String(Date.now())}`

  const response = await page.goto('/catalog')

  // 빌드할 때 만든 HTML에는 목록이 없고, 브라우저가 가져와 그린다.
  const html = (await response?.text()) ?? ''
  for (const product of PRODUCT_NAMES) expect(html).not.toContain(product)
  for (const product of PRODUCT_NAMES) {
    await expect(page.getByRole('listitem').filter({ hasText: product })).toBeVisible()
  }
  await registerProduct(page, name)

  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
})

test('폼만 둔 페이지에서 상품을 등록하면 성공을 알린다', async ({ page }) => {
  await page.goto('/products/new')
  await page.waitForLoadState('networkidle')

  await registerProduct(page, `새 상품 ${String(Date.now())}`)
})

test('/modes/ssg는 빌드할 때 가져온 목록을 HTML에 담아 보낸다', async ({ page }) => {
  const response = await page.goto('/modes/ssg')

  const html = (await response?.text()) ?? ''
  for (const name of PRODUCT_NAMES) expect(html).toContain(name)
  for (const name of PRODUCT_NAMES) await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
})

for (const path of ['/catalog', '/products/new', '/modes/ssg']) {
  test(`${path}에 WCAG 2.2 AA 접근성 위반이 없다`, async ({ page }) => {
    await page.goto(path)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // 데이터를 기다리는 화면은 데이터까지 그린 뒤에 검사한다.
    await expect(page.getByText(LOADING_MESSAGE)).toHaveCount(0)
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
  })
}
