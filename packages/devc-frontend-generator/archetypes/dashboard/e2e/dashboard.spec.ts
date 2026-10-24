import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { BFF_PROXY_PATH } from '@/shared/api/base-url'
import { MOCK_PASSWORD } from '@/shared/auth/auth-mock-handlers'
import { SESSION_API_PATH } from '@/shared/auth/auth-client'
import { contrastRatio, NON_TEXT_CONTRAST_MIN } from '@/shared/chart/chart-contrast'

// 대시보드 Archetype의 흐름. E2E 대상 서버의 백엔드는 목 백엔드(auth의 src/shared/auth/auth-mock-handlers.ts, 대시보드의
// src/shared/mocks/users.ts)이고, 추가하고 고친 사용자는 서버를 다시 띄울 때까지 남는다. 그래서 테스트마다 새 이메일로
// 사용자를 추가하고, 통계는 추가하기 전과 비교한다. 목 백엔드는 실제 백엔드처럼 accessToken으로 로그인과 역할을 확인하고,
// 대시보드의 사용자와 로그인하는 계정은 같은 사용자 저장소에 있다. 다른 테스트(다른 파일의 테스트는 동시에 돈다)가 쓰는 목
// 계정의 역할은 바꾸지 않고, 역할을 바꿔 볼 계정은 새로 만든다.

const USER = { email: 'user@example.com', name: '김사용' }
const ADMIN = { email: 'admin@example.com', name: '박관리' }

async function login(page: Page, email: string, path = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`)
  await page.getByRole('textbox', { name: '이메일' }).fill(email)
  await page.getByLabel('비밀번호').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(path)
}

/**
 * 화면을 거치지 않고 같은 브라우저의 로그인 세션을 email의 사용자로 바꾼다. 다른 탭에서 다른 계정으로 로그인한 것과 같다.
 * page.request는 브라우저와 쿠키를 함께 쓰므로 바뀐 세션 쿠키가 브라우저에도 남는다.
 */
async function switchSession(page: Page, email: string) {
  const response = await page.request.post(SESSION_API_PATH, { data: { email, password: MOCK_PASSWORD } })
  expect(response.status()).toBe(200)
}

/** 처음 보는 이름과 이메일. E2E 대상 서버의 목 백엔드는 테스트 사이에 사용자를 기억하므로 테스트마다 새로 만든다. */
function uniqueUser(prefix: string) {
  const suffix = `${String(Date.now())}-${String(test.info().workerIndex)}`
  return { name: `${prefix} ${suffix}`, email: `${prefix}-${suffix}@example.com` }
}

async function fillNewUserForm(page: Page, user: { name: string; email: string }) {
  await page.getByRole('textbox', { name: '이름' }).fill(user.name)
  await page.getByRole('textbox', { name: '이메일' }).fill(user.email)
  await page.getByRole('combobox', { name: '역할' }).click()
  await page.getByRole('option', { name: '사용자' }).click()
}

/** 대시보드 개요의 전체 사용자 수 */
async function totalUsers(page: Page): Promise<number> {
  const figure = page.getByRole('region', { name: '사용자 현황' }).getByRole('definition').first()
  return Number((await figure.innerText()).replace(/\D/g, ''))
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_22_AA_TAGS]).analyze()
  expect(results.violations).toEqual([])
}

/** 관리자로 로그인한 page에서 사용자 수정 화면으로 userId의 역할을 바꾼다. */
async function changeRole(page: Page, userId: number, role: '관리자' | '사용자') {
  await page.goto(`/dashboard/users/${String(userId)}/edit`)
  await page.getByRole('combobox', { name: '역할' }).click()
  await page.getByRole('option', { name: role }).click()
  await page.getByRole('button', { name: '사용자 수정' }).click()
  await expect(page).toHaveURL('/dashboard/users')
}

/** page에 로그인한 사용자가 사용자를 추가하고 고칠 수 있는지 화면과 BFF 프록시로 확인한다. */
async function expectCanManageUsers(page: Page, canManage: boolean, userId: number) {
  await page.goto('/dashboard/users')
  await expect(page.getByRole('link', { name: '사용자 추가' })).toHaveCount(canManage ? 1 : 0)
  for (const [path, heading] of [
    ['/dashboard/users/new', '사용자 추가'],
    [`/dashboard/users/${String(userId)}/edit`, '사용자 수정'],
  ] as const) {
    const visited = await page.goto(path)
    expect(visited?.status(), path).toBe(canManage ? 200 : 403)
    await expect(page).toHaveURL(path)
    await expect(
      page.getByRole('heading', { level: 1, name: canManage ? heading : '접근 권한이 없습니다' }),
    ).toBeVisible()
  }
  const created = await page.request.post(`${BFF_PROXY_PATH}/users`, { data: { ...uniqueUser('by'), role: 'user' } })
  expect(created.status()).toBe(canManage ? 201 : 403)
}

/** 본문 행마다 첫 칸(이름) */
async function listedNames(page: Page): Promise<string[]> {
  return page.getByRole('table', { name: '사용자 목록' }).locator('tbody tr td:first-child').allInnerTexts()
}

test('로그인하지 않고 대시보드에 들어가면 로그인 페이지로 가고, 로그인하면 돌아와 사용자 통계와 차트를 본다', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('banner').getByRole('link', { name: '대시보드' }).click()

  await expect(page).toHaveURL('/login?next=%2Fdashboard')
  await page.getByRole('textbox', { name: '이메일' }).fill(USER.email)
  await page.getByLabel('비밀번호').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('heading', { level: 1, name: '대시보드' })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: '대시보드 화면' }).getByRole('link', { name: '개요' }),
  ).toHaveAttribute('aria-current', 'page')
  // 사용자 통계는 서버가 가져와 넘겼으므로 바로 보인다. 차트는 그림 대신 같은 값을 담은 데이터 표를 스크린 리더에 둔다.
  expect(await totalUsers(page)).toBeGreaterThanOrEqual(12)
  await expect(page.getByRole('table', { name: '상태별 사용자 수' })).toBeAttached()
  // chart Recipe의 통계 차트도 함께 보인다.
  await expect(page.getByRole('figure', { name: '일별 방문 수' })).toBeVisible()
  await expectNoAxeViolations(page)
})

test('관리자는 사용자를 추가하면 목록 맨 앞에서 보고 통계에도 더해지며, 그 사용자를 고칠 수 있다', async ({ page }) => {
  const suffix = `${String(Date.now())}-${String(test.info().workerIndex)}`
  const newUser = { name: `새사용자 ${suffix}`, email: `new-${suffix}@example.com` }
  await login(page, ADMIN.email)
  const before = await totalUsers(page)

  await page.getByRole('navigation', { name: '대시보드 화면' }).getByRole('link', { name: '사용자' }).click()
  await expect(page).toHaveURL('/dashboard/users')
  await page.getByRole('link', { name: '사용자 추가' }).click()
  await expect(page).toHaveURL('/dashboard/users/new')
  await expectNoAxeViolations(page)

  await page.getByRole('textbox', { name: '이름' }).fill(newUser.name)
  await page.getByRole('textbox', { name: '이메일' }).fill(newUser.email)
  await page.getByRole('combobox', { name: '역할' }).click()
  await page.getByRole('option', { name: '사용자' }).click()
  await page.getByRole('textbox', { name: '부서' }).fill('품질팀')
  await page.getByRole('button', { name: '사용자 추가' }).click()

  // 추가하면 목록으로 돌아오고, 정렬하지 않은 목록은 최근에 추가한 사용자부터 보인다.
  await expect(page).toHaveURL('/dashboard/users')
  await expect(page.getByText('사용자를 추가했습니다')).toBeVisible()
  await expect.poll(async () => (await listedNames(page))[0]).toBe(newUser.name)
  const row = page.getByRole('row').filter({ hasText: newUser.email })
  await expect(row).toContainText('초대됨')
  await expect(row).toContainText('품질팀')
  await expectNoAxeViolations(page)

  await page.getByRole('navigation', { name: '대시보드 화면' }).getByRole('link', { name: '개요' }).click()
  await expect.poll(() => totalUsers(page)).toBe(before + 1)

  // 고치기: 상태를 활성으로 바꾸면 목록에 반영된다.
  await page.goto('/dashboard/users')
  await page.getByRole('link', { name: `${newUser.name} 수정` }).click()
  await expect(page.getByRole('heading', { level: 1, name: '사용자 수정' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '이메일' })).toHaveValue(newUser.email)
  await page.getByRole('combobox', { name: '상태' }).click()
  await page.getByRole('option', { name: '활성' }).click()
  await page.getByRole('button', { name: '사용자 수정' }).click()

  await expect(page).toHaveURL('/dashboard/users')
  await expect(page.getByRole('row').filter({ hasText: newUser.email })).toContainText('활성')
})

test('관리자가 아니면 사용자 목록은 보지만 추가·수정 링크가 없고, 그 화면에 들어가면 주소는 그대로 둔 채 접근 권한 없음을 보여 준다', async ({
  page,
}) => {
  await login(page, USER.email, '/dashboard/users')

  await page.getByRole('searchbox', { name: '이름·이메일 검색' }).fill(ADMIN.email)
  await page.getByRole('button', { name: '검색' }).click()
  await expect(page.getByRole('status')).toHaveText('사용자 1명 중 1–1번째')
  await expect(page.getByRole('row').filter({ hasText: ADMIN.email })).toContainText(ADMIN.name)
  await expect(page.getByRole('link', { name: '사용자 추가' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: / 수정$/ })).toHaveCount(0)

  for (const path of ['/dashboard/users/new', '/dashboard/users/1/edit']) {
    const denied = await page.goto(path)
    expect(denied?.status(), path).toBe(403)
    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { level: 1, name: '접근 권한이 없습니다' })).toBeVisible()
  }
})

test('목록은 정렬과 필터를 키보드로 조작하고, 없는 사용자의 수정 화면은 찾을 수 없다고 알린다', async ({ page }) => {
  await login(page, ADMIN.email, '/dashboard/users')

  await page.getByRole('button', { name: '이름' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('columnheader', { name: '이름' })).toHaveAttribute('aria-sort', 'ascending')
  await page.getByRole('combobox', { name: '역할' }).click()
  await page.getByRole('option', { name: '관리자' }).click()
  await expect.poll(() => listedNames(page)).toEqual(['박관리', '정하준', '한예준'])

  // 페이지는 loading.tsx를 먼저 보내며 스트리밍하므로 상태 코드 대신 화면으로 알린다.
  await page.goto('/dashboard/users/99999/edit')
  await expect(page.getByRole('heading', { level: 1, name: '찾는 화면이 없습니다' })).toBeVisible()
  await page.getByRole('link', { name: '사용자 목록으로' }).click()
  await expect(page).toHaveURL('/dashboard/users')
})

test('사용자 관리 API는 백엔드가 로그인과 역할을 확인한다: 로그인하지 않으면 401, 관리자가 아닌 사용자의 추가·수정은 403, 관리자의 추가는 201', async ({
  page,
}) => {
  // 화면의 링크와 접근 규칙을 거치지 않고 브라우저가 BFF 프록시로 바로 보내도 백엔드가 거절한다.
  const newUser = { ...uniqueUser('api'), role: 'user' }
  const createUser = () => page.request.post(`${BFF_PROXY_PATH}/users`, { data: newUser })

  expect((await page.request.get(`${BFF_PROXY_PATH}/users`)).status()).toBe(401)
  expect((await createUser()).status()).toBe(401)

  await switchSession(page, USER.email)
  expect((await page.request.get(`${BFF_PROXY_PATH}/users/stats`)).status()).toBe(200)
  expect((await createUser()).status()).toBe(403)
  const update = { name: USER.name, email: USER.email, role: 'admin', status: 'active' }
  expect((await page.request.put(`${BFF_PROXY_PATH}/users/1`, { data: update })).status()).toBe(403)

  await switchSession(page, ADMIN.email)
  const created = await createUser()
  expect(created.status()).toBe(201)
  expect(await created.json()).toMatchObject({ email: newUser.email, status: 'invited' })
})

test('추가 폼을 연 뒤 관리자가 아닌 계정으로 로그인이 바뀌면, 저장을 백엔드가 403으로 거절하고 주소는 그대로 둔 채 접근 권한 없음을 보여 준다', async ({
  page,
}) => {
  await login(page, ADMIN.email, '/dashboard/users/new')
  await switchSession(page, USER.email)

  await fillNewUserForm(page, uniqueUser('denied'))
  const rejected = page.waitForResponse((response) => response.url().endsWith(`${BFF_PROXY_PATH}/users`))
  await page.getByRole('button', { name: '사용자 추가' }).click()

  expect((await rejected).status()).toBe(403)
  await expect(page.getByRole('heading', { level: 1, name: '접근 권한이 없습니다' })).toBeVisible()
  await expect(page).toHaveURL('/dashboard/users/new')
})

test('추가 폼을 연 뒤 로그아웃되면, 저장을 백엔드가 401로 거절하고 로그인 페이지로 보내며 로그인하면 추가 폼으로 돌아온다', async ({
  page,
}) => {
  await login(page, ADMIN.email, '/dashboard/users/new')
  expect((await page.request.delete(SESSION_API_PATH)).ok()).toBe(true)

  await fillNewUserForm(page, uniqueUser('expired'))
  const rejected = page.waitForResponse((response) => response.url().endsWith(`${BFF_PROXY_PATH}/users`))
  await page.getByRole('button', { name: '사용자 추가' }).click()

  expect((await rejected).status()).toBe(401)
  await expect(page).toHaveURL('/login?next=%2Fdashboard%2Fusers%2Fnew')
  await page.getByRole('textbox', { name: '이메일' }).fill(ADMIN.email)
  await page.getByLabel('비밀번호').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL('/dashboard/users/new')
})

test('관리자가 사용자의 역할을 바꾸면 그 계정은 다시 로그인한 뒤 바뀐 역할로 동작한다: 관리자로 올리면 사용자를 추가·수정하고, 다시 사용자로 내리면 접근 권한 없음과 백엔드의 403을 받는다', async ({
  page,
  browser,
}) => {
  // 역할을 바꿔 볼 계정을 사용자 역할로 새로 만든다. 대시보드에서 추가한 사용자도 로그인하는 계정이라 MOCK_PASSWORD로 로그인한다.
  await login(page, ADMIN.email, '/dashboard/users')
  const member = uniqueUser('member')
  const created = await page.request.post(`${BFF_PROXY_PATH}/users`, { data: { ...member, role: 'user' } })
  expect(created.status()).toBe(201)
  const { id } = (await created.json()) as { id: number }

  const memberContext = await browser.newContext()
  try {
    const memberPage = await memberContext.newPage()
    await login(memberPage, member.email, '/dashboard/users')
    await expectCanManageUsers(memberPage, false, id)

    await changeRole(page, id, '관리자')
    await login(memberPage, member.email, '/dashboard/users')
    await expectCanManageUsers(memberPage, true, id)

    await changeRole(page, id, '사용자')
    // 목 백엔드는 요청마다 accessToken의 사용자를 다시 찾으므로, 다시 로그인하기 전의 세션으로 보낸 요청도 바로 거절한다.
    // 세션 쿠키에 담긴 역할(화면의 접근 규칙)은 다음 로그인이나 refresh부터 바뀐다.
    const beforeLogin = await memberPage.request.post(`${BFF_PROXY_PATH}/users`, {
      data: { ...uniqueUser('stale'), role: 'user' },
    })
    expect(beforeLogin.status()).toBe(403)
    await login(memberPage, member.email, '/dashboard/users')
    await expectCanManageUsers(memberPage, false, id)
  } finally {
    await memberContext.close()
  }
})

// dark-mode Recipe를 함께 넣은 Starter에서는 운영체제가 다크 모드이면 다크 테마로 열리므로, 다크 테마의 토큰으로도 확인한다.
// axe는 SVG의 막대를 보지 않으므로 명도 대비를 직접 잰다.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`운영체제가 ${colorScheme === 'light' ? '라이트' : '다크'} 모드이면`, () => {
    test.use({ colorScheme })

    test('상태별 사용자 수 차트의 막대가 배경 위에서 읽힌다', async ({ page }) => {
      await login(page, USER.email)

      // 대시보드에는 다른 차트도 있을 수 있으므로(chart Recipe의 통계 등) 상태별 사용자 수 차트 안의 막대만 본다. 차트는 데이터를
      // 다시 받으면 막대를 다시 그리므로, 세 막대의 색을 한 번에 읽고 다 그려질 때까지 다시 읽는다.
      const chart = page.getByRole('figure', { name: '상태별 사용자 수' })
      const colors = () =>
        chart.evaluate((figure) => ({
          background: getComputedStyle(document.body).backgroundColor,
          fills: [...figure.querySelectorAll('.recharts-bar .recharts-rectangle')].map(
            (rectangle) => getComputedStyle(rectangle).fill,
          ),
        }))
      await expect.poll(async () => (await colors()).fills.filter((fill) => fill.startsWith('rgb'))).toHaveLength(3)

      const { background, fills } = await colors()
      for (const fill of fills) {
        expect(contrastRatio(fill, background), fill).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST_MIN)
      }
    })
  })
}
