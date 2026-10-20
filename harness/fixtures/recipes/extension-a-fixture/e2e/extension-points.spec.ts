import { expect, test } from '@playwright/test'

// 시험용 Recipe extension-a-fixture와 extension-b-fixture를 함께 켠 Starter에서 두 Recipe의 조각이 order대로 조립되었는지 본다.
// order: Provider는 b(50) → Base의 QueryProvider(100) → ToastProvider(200) → a(300), 머리글은 b(100) → a(200),
// next.config 래퍼와 instrumentation-client는 b(100) → a(200)이다.

const clientHooks = () => (globalThis as { fixtureClientHooks?: string[] }).fixtureClientHooks

test('Provider는 order가 작은 것이 바깥을 감싸고, 머리글 항목은 order 순으로 놓인다', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('[data-fixture-provider="b"] [data-fixture-provider="a"] h1')).toHaveText('Starter')
  await expect(page.locator('header [data-fixture-header-item]')).toHaveText(['fixture-b', 'fixture-a'])
})

test('next.config 래퍼는 Provider처럼 order가 작은 것이 바깥을 감싼다', async ({ page }) => {
  await page.goto('/extension-fixture')

  // 안쪽의 a가 먼저 씌워지고 바깥의 b가 그 결과를 감싼다.
  await expect(page.getByTestId('next-config')).toHaveText('ab')
})

test('instrumentation-client 조각은 order 순으로 먼저 실행되고, 페이지를 옮길 때도 알림을 받는다', async ({ page }) => {
  await page.goto('/extension-fixture')
  await expect.poll(() => page.evaluate(clientHooks)).toEqual(['b', 'a'])

  await page.getByRole('link', { name: '홈' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect.poll(() => page.evaluate(clientHooks)).toEqual(['b', 'a', 'b:push', 'a:push'])
})
