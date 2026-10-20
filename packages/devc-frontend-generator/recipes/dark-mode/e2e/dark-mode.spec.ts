import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { THEME_STORAGE_KEY } from '@/shared/theme/theme'

// 화면에 실제로 적용된 테마. tokens-dark.css는 다크 테마에서 color-scheme을 dark로 바꾼다.
async function appliedTheme(page: Page) {
  return page.locator('html').evaluate((html) => ({
    attribute: html.dataset['theme'],
    colorScheme: getComputedStyle(html).colorScheme,
    background: getComputedStyle(document.body).backgroundColor,
  }))
}

async function chooseTheme(page: Page, label: string) {
  await page.getByRole('combobox', { name: '테마' }).click()
  await page.getByRole('option', { name: label }).click()
  await expect(page.getByRole('combobox', { name: '테마' })).toHaveText(label)
}

// 페이지에서 난 오류(예: hydration 불일치)를 모은다.
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

test.describe('운영체제가 다크 모드이면', () => {
  test.use({ colorScheme: 'dark' })

  test('고른 테마가 없을 때 다크 테마로 열리고 WCAG 2.2 AA 위반이 없다', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')

    await expect(page.getByRole('combobox', { name: '테마' })).toHaveText('시스템 설정')
    expect(await appliedTheme(page)).toMatchObject({ attribute: 'dark', colorScheme: 'dark' })
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
    expect(errors).toEqual([])
  })

  test('라이트를 고르면 운영체제 설정과 달리 라이트 테마가 된다', async ({ page }) => {
    await page.goto('/')
    const dark = await appliedTheme(page)

    await chooseTheme(page, '라이트')

    const light = await appliedTheme(page)
    expect(light).toMatchObject({ attribute: 'light', colorScheme: 'normal' })
    expect(light.background).not.toBe(dark.background)
  })
})

test.describe('운영체제가 라이트 모드이면', () => {
  test.use({ colorScheme: 'light' })

  test('고른 테마가 없을 때 라이트 테마로 열린다', async ({ page }) => {
    await page.goto('/')

    expect(await appliedTheme(page)).toMatchObject({ attribute: 'light', colorScheme: 'normal' })
  })

  test('다크를 고르면 다시 열어도 다크 테마이고 WCAG 2.2 AA 위반이 없다', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    await chooseTheme(page, '다크')
    expect(await appliedTheme(page)).toMatchObject({ attribute: 'dark', colorScheme: 'dark' })

    await page.reload()

    await expect(page.getByRole('combobox', { name: '테마' })).toHaveText('다크')
    expect(await appliedTheme(page)).toMatchObject({ attribute: 'dark', colorScheme: 'dark' })
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
    expect(errors).toEqual([])
  })

  test('시스템 설정을 고르면 저장한 선택을 지우고 운영체제 설정을 따른다', async ({ page }) => {
    await page.goto('/')
    await chooseTheme(page, '다크')

    await chooseTheme(page, '시스템 설정')

    expect(await appliedTheme(page)).toMatchObject({ attribute: 'light', colorScheme: 'normal' })
    expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBeNull()
  })

  test('저장된 테마는 앱의 JavaScript가 실행되기 전에 적용되어 첫 화면이 깜빡이지 않는다', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'dark')
    }, THEME_STORAGE_KEY)
    // 앱의 JavaScript(React, Next.js)를 막아도 HTML에 담긴 테마 스크립트만으로 다크 테마가 적용되어야 한다.
    await page.route('**/_next/static/**/*.js', (route) => route.abort())

    await page.goto('/')

    expect(await appliedTheme(page)).toMatchObject({ attribute: 'dark', colorScheme: 'dark' })
  })
})
