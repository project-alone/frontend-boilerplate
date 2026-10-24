// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/e2e/auth.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { BFF_PROXY_PATH } from '@/shared/api/base-url'
import { SESSION_COOKIE } from '@/shared/auth/auth-client'
import { MOCK_ACCESS_TOKEN_TTL_SECONDS, MOCK_PASSWORD } from '@/shared/auth/auth-mock-handlers'

// auth Recipe의 로그인 흐름. E2E 대상 서버의 백엔드는 목 백엔드(src/shared/auth/auth-mock-handlers.ts)이고, 목 백엔드의
// accessToken은 MOCK_ACCESS_TOKEN_TTL_SECONDS 뒤에 만료된다.

const USER = { email: 'user@example.com', name: '김사용' }
const ADMIN = { email: 'admin@example.com', name: '박관리' }

async function fillLoginForm(page: Page, email: string, password = MOCK_PASSWORD) {
  await page.getByRole('textbox', { name: '이메일' }).fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
}

async function loginAs(page: Page, email: string) {
  await page.goto('/login?next=/account')
  await fillLoginForm(page, email)
  await expect(page).toHaveURL('/account')
}

async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find(({ name }) => name === SESSION_COOKIE)
}

test('보호된 라우트에 로그인하지 않고 들어가면 로그인 페이지로 가고, 로그인하면 돌아와 사용자 정보를 본다', async ({
  page,
  context,
}) => {
  await page.goto('/account')

  await expect(page).toHaveURL('/login?next=%2Faccount')
  await expect(page.getByRole('link', { name: '로그인' })).toBeVisible()
  await fillLoginForm(page, USER.email)

  await expect(page).toHaveURL('/account')
  await expect(page.getByRole('heading', { level: 1, name: '내 정보' })).toBeVisible()
  await expect(page.getByText(USER.email)).toBeVisible()
  // 머리글의 사용자 메뉴가 로그인한 사용자를 보여 준다.
  await expect(page.getByRole('banner').getByRole('link', { name: USER.name })).toBeVisible()

  // 토큰은 브라우저의 JavaScript가 읽을 수 없는 쿠키에 암호화되어 있다.
  const cookie = await sessionCookie(context)
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' })
  expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE)
})

test('이메일이나 비밀번호가 맞지 않으면 알리고 로그인하지 않는다', async ({ page, context }) => {
  await page.goto('/login')

  await fillLoginForm(page, USER.email, 'wrong-password')

  await expect(page.getByRole('main').getByRole('alert')).toHaveText('이메일이나 비밀번호가 맞지 않습니다.')
  await expect(page).toHaveURL('/login')
  expect(await sessionCookie(context)).toBeUndefined()
})

test('역할이 필요한 라우트는 그 역할이 있는 사용자만 들어가고, 없으면 주소는 그대로 둔 채 접근 권한 없음을 보여 준다', async ({
  page,
  browser,
}) => {
  await loginAs(page, USER.email)

  const denied = await page.goto('/admin')

  expect(denied?.status()).toBe(403)
  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('heading', { level: 1, name: '접근 권한이 없습니다' })).toBeVisible()

  const adminContext = await browser.newContext()
  try {
    const adminPage = await adminContext.newPage()
    await loginAs(adminPage, ADMIN.email)

    const allowed = await adminPage.goto('/admin')

    expect(allowed?.status()).toBe(200)
    await expect(adminPage.getByRole('heading', { level: 1, name: '관리자' })).toBeVisible()
  } finally {
    await adminContext.close()
  }
})

test('accessToken이 만료되어도 다시 로그인하지 않고 페이지 이동과 브라우저의 API 요청 모두 자동으로 refresh된다', async ({
  page,
  context,
  browser,
}) => {
  test.slow()
  // 페이지를 다시 여는 사용자(proxy가 refresh)와 브라우저에서 API를 다시 부르는 사용자(BFF 프록시가 401을 받고 refresh)
  const apiContext = await browser.newContext()
  try {
    const apiPage = await apiContext.newPage()
    await loginAs(page, USER.email)
    await loginAs(apiPage, USER.email)
    const before = { page: await sessionCookie(context), api: await sessionCookie(apiContext) }

    // 목 백엔드의 accessToken이 만료되기를 기다린다.
    await page.waitForTimeout((MOCK_ACCESS_TOKEN_TTL_SECONDS + 1) * 1000)

    const reloaded = await page.reload()
    expect(reloaded?.status()).toBe(200)
    await expect(page).toHaveURL('/account')
    await expect(page.getByText(USER.email)).toBeVisible()
    expect((await sessionCookie(context))?.value).not.toBe(before.page?.value)

    const refetched = apiPage.waitForResponse((response) => response.url().endsWith(`${BFF_PROXY_PATH}/auth/me`))
    await apiPage.getByRole('button', { name: '다시 불러오기' }).click()
    expect((await refetched).status()).toBe(200)
    await expect(apiPage.getByRole('button', { name: '다시 불러오기' })).toBeEnabled()
    await expect(apiPage.getByRole('main').getByRole('alert')).toHaveCount(0)
    expect((await sessionCookie(apiContext))?.value).not.toBe(before.api?.value)
  } finally {
    await apiContext.close()
  }
})

test('로그아웃하면 세션 쿠키가 지워지고, 보호된 라우트에 다시 들어가면 로그인 페이지로 간다', async ({
  page,
  context,
}) => {
  await loginAs(page, USER.email)

  await page.getByRole('banner').getByRole('button', { name: '로그아웃' }).click()

  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('banner').getByRole('link', { name: '로그인' })).toBeVisible()
  expect(await sessionCookie(context)).toBeUndefined()
  await page.goto('/account')
  await expect(page).toHaveURL('/login?next=%2Faccount')
})

test('브라우저의 JavaScript가 BFF 프록시로 토큰을 발급하는 login·refreshTokens를 불러도 403이고 토큰을 받지 못한다', async ({
  page,
}) => {
  await loginAs(page, USER.email)

  // 브라우저에서 생성된 login·refreshTokens를 부르는 것과 같은 요청이다. 세션 쿠키가 실려 있어도 BFF 프록시는 백엔드로 보내지 않는다.
  const responses = await page.evaluate(
    async ({ proxy, email, password }) => {
      const post = async (path: string, body: unknown) => {
        const response = await fetch(`${proxy}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        return { status: response.status, text: await response.text() }
      }
      return [await post('/auth/login', { email, password }), await post('/auth/refresh', { refreshToken: 'any' })]
    },
    { proxy: BFF_PROXY_PATH, email: USER.email, password: MOCK_PASSWORD },
  )

  for (const { status, text } of responses) {
    expect(status).toBe(403)
    expect(text).toContain('/api/session')
    expect(text).not.toMatch(/mock-(?:access|refresh)-/)
  }
  // 막은 요청은 로그인 세션을 바꾸지 않는다.
  await page.reload()
  await expect(page.getByText(USER.email)).toBeVisible()
})

for (const path of ['/login', '/account', '/forbidden']) {
  test(`${path}에 WCAG 2.2 AA 접근성 위반이 없다`, async ({ page }) => {
    if (path === '/account') await loginAs(page, USER.email)
    else await page.goto(path)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
  })
}
