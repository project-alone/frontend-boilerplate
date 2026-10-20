import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

test('홈 페이지가 열리고 WCAG 2.2 AA 접근성 위반이 없다', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Starter' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
  expect(violations).toEqual([])
})
