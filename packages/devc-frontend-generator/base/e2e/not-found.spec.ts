import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// 앱 수준의 404 화면(src/app/not-found.tsx). 어느 라우트에도 맞지 않는 주소는 이 화면을 상태 코드 404와 함께 받는다.
// static-export Starter에서는 빌드가 이 화면으로 만든 out/404.html을 정적 파일 서버가 보낸다.
const MISSING_PATH = '/no-such-page'

test('없는 주소는 Starter의 404 화면을 상태 코드 404와 함께 보여 주고, 홈으로 가는 링크를 준다', async ({ page }) => {
  const response = await page.goto(MISSING_PATH)

  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: '찾는 화면이 없습니다' })).toBeVisible()
  await expect(page).toHaveTitle(/찾는 화면이 없습니다/)
  await expect(page.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
})

test('404 화면에 WCAG 2.2 AA 접근성 위반이 없다', async ({ page }) => {
  await page.goto(MISSING_PATH)

  await expect(page.getByRole('heading', { level: 1, name: '찾는 화면이 없습니다' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
  expect(violations).toEqual([])
})
