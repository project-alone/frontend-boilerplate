// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/e2e/dashboard.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { MOCK_PASSWORD } from '@/shared/auth/auth-mock-handlers'

// 대시보드 Archetype의 흐름. E2E 대상 서버의 백엔드는 목 백엔드(auth의 src/shared/auth/auth-mock-handlers.ts, 대시보드의
// src/shared/mocks/users.ts)이고, 추가하고 고친 사용자는 서버를 다시 띄울 때까지 남는다. 그래서 테스트마다 새 이메일로
// 사용자를 추가하고, 통계는 추가하기 전과 비교한다.

const USER = { email: 'user@example.com', name: '김사용' }
const ADMIN = { email: 'admin@example.com', name: '박관리' }

async function login(page: Page, email: string, path = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`)
  await page.getByRole('textbox', { name: '이메일' }).fill(email)
  await page.getByLabel('비밀번호').fill(MOCK_PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(path)
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
