// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/table/e2e/table.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// table Recipe: 빌드한 앱의 /members에서 회원 목록 테이블을 키보드로 조작한다. 회원 목록은 브라우저가 요청하고
// (server는 BFF 프록시, static-export는 백엔드 주소로 직접), MSW의 회원 목록 핸들러(src/shared/mocks/members.ts)가
// 쿼리 파라미터대로 거르고 정렬한 결과를 돌려준다.

/** 브라우저가 회원 목록(listMembers)을 요청할 때마다 보낸 쿼리 파라미터를 모은다. */
function recordMemberRequests(page: Page): Record<string, string>[] {
  const requests: Record<string, string>[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith('/members')) requests.push(Object.fromEntries(url.searchParams))
  })
  return requests
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

/** Tab 키만 눌러 target까지 포커스를 옮긴다. 다른 Recipe가 머리글에 더한 요소가 있어도 된다. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 30; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

/** 본문 행마다 첫 칸(이름)을 읽는다. */
function memberNames(page: Page) {
  return page.getByRole('table', { name: '회원 목록' }).locator('tbody tr td:first-child')
}

test('페이지 뼈대는 회원 없이 오고, 브라우저가 가져온 첫 페이지를 가입한 순서로 보여 준다', async ({ page }) => {
  const errors = collectErrors(page)
  const requests = recordMemberRequests(page)

  const response = await page.goto('/members')

  const html = (await response?.text()) ?? ''
  expect(html).toContain('회원을 불러오는 중입니다.')
  expect(html).not.toContain('김하늘')
  await expect(page.getByRole('status')).toHaveText('회원 24명 중 1–10번째')
  await expect(memberNames(page)).toHaveText([
    '김하늘',
    '이도윤',
    '박서연',
    '최민준',
    '정지우',
    '강예린',
    '조현우',
    '윤서아',
    '장민서',
    '임준호',
  ])
  expect(requests.at(-1)).toEqual({ page: '1', pageSize: '10' })
  expect(errors).toEqual([])
})

test('키보드만으로 정렬하고, 검색어와 역할로 거르고, 그 상태를 요청 파라미터로 보낸다', async ({ page }) => {
  const requests = recordMemberRequests(page)
  await page.goto('/members')
  const status = page.getByRole('status')
  await expect(status).toHaveText('회원 24명 중 1–10번째')

  // 정렬: 열 머리글의 버튼에서 Enter를 누를 때마다 오름차순, 내림차순으로 바뀐다.
  const nameHeader = page.getByRole('columnheader', { name: '이름' })
  await tabTo(page, nameHeader.getByRole('button', { name: '이름' }))
  await page.keyboard.press('Enter')
  await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
  await expect(memberNames(page).first()).toHaveText('강예린')
  await page.keyboard.press('Enter')
  await expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
  await expect(memberNames(page).first()).toHaveText('황태민')
  expect(requests.at(-1)).toEqual({ sort: 'name', order: 'desc', page: '1', pageSize: '10' })

  // 검색: 검색어를 입력하고 Enter를 누른다.
  await tabTo(page, page.getByRole('searchbox', { name: '이름·이메일 검색' }))
  await page.keyboard.type('SEO')
  await page.keyboard.press('Enter')
  await expect(status).toHaveText('회원 4명 중 1–4번째')
  await expect(memberNames(page)).toHaveText(['장민서', '윤서아', '서유진', '박서연'])
  expect(requests.at(-1)).toEqual({ q: 'SEO', sort: 'name', order: 'desc', page: '1', pageSize: '10' })

  // 역할 필터: 선택 버튼에서 화살표 키로 목록을 열고(지금 고른 항목에 포커스가 간다) 다음 항목으로 옮겨 고른다.
  const roleFilter = page.getByRole('combobox', { name: '역할' })
  await tabTo(page, roleFilter)
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: '전체' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: '관리자' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(roleFilter).toHaveText('관리자')
  await expect(status).toHaveText('회원 1명 중 1–1번째')
  await expect(memberNames(page)).toHaveText(['서유진'])
  expect(requests.at(-1)).toEqual({ q: 'SEO', role: 'admin', sort: 'name', order: 'desc', page: '1', pageSize: '10' })
})

test('다음 페이지로 넘기고, 정렬을 바꾸면 첫 페이지로 돌아온다', async ({ page }) => {
  const requests = recordMemberRequests(page)
  await page.goto('/members')
  const status = page.getByRole('status')
  await expect(status).toHaveText('회원 24명 중 1–10번째')

  await page.getByRole('button', { name: '다음' }).click()

  await expect(status).toHaveText('회원 24명 중 11–20번째')
  await expect(memberNames(page).first()).toHaveText('한지민')
  expect(requests.at(-1)).toEqual({ page: '2', pageSize: '10' })

  await page.getByRole('button', { name: '가입일' }).click()

  await expect(status).toHaveText('회원 24명 중 1–10번째')
  await expect(memberNames(page).first()).toHaveText('문시우')
  expect(requests.at(-1)).toEqual({ sort: 'joinedAt', order: 'asc', page: '1', pageSize: '10' })
})

test('회원 페이지에 WCAG 2.2 AA 접근성 위반이 없다(정렬한 상태 포함)', async ({ page }) => {
  await page.goto('/members')
  await expect(page.getByRole('heading', { level: 1, name: '회원' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('회원 24명 중 1–10번째')
  await page.getByRole('button', { name: '이름' }).click()
  await expect(page.getByRole('columnheader', { name: '이름' })).toHaveAttribute('aria-sort', 'ascending')
  await expect(page.getByRole('table', { name: '회원 목록' })).toHaveAttribute('aria-busy', 'false')

  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
  expect(violations).toEqual([])
})
