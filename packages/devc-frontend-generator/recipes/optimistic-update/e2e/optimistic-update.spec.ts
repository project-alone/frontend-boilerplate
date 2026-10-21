import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// optimistic-update Recipe: 빌드한 앱의 /todos에서 할 일의 완료 여부를 바꾼다. 저장 요청은 브라우저가 보내고(server는 BFF
// 프록시, static-export는 백엔드 주소로 직접), MSW의 할 일 핸들러(src/shared/mocks/todos.ts)가 1초 뒤에 답한다. 그 핸들러는
// 보안 점검 할 일을 늘 거절하므로, 실패와 되돌리기를 테스트만의 코드 없이 같은 할 일로 재현한다. 되돌린 값이 목록을 다시
// 가져오기 전에 보이는지(뮤테이션 훅의 onError)는 응답 시점을 붙잡을 수 있는 컴포넌트 테스트(todo-list.test.tsx)가 본다.
//
// server에서는 목 백엔드가 Next.js 서버의 메모리에 바뀐 값을 기억하므로, 할 일을 바꾼 테스트는 끝나기 전에 되돌려 둔다.

// 목 백엔드가 거절하는 할 일과 그 이유(명세의 example)
const REJECTED_TODO = '보안 점검 결과 승인하기(보안 담당자만 바꿀 수 있음)'
const REJECTED_REASON = '보안 점검 결과는 보안 담당자만 승인할 수 있습니다.'

/** 브라우저가 받은 저장(updateTodo) 응답의 상태 코드를 받은 순서로 모은다. 응답 전에 화면이 바뀌었는지 볼 때 쓴다. */
function recordSaveResponses(page: Page): number[] {
  const statuses: number[] = []
  page.on('response', (response) => {
    const isSave = response.request().method() === 'PATCH' && /\/todos\/\d+$/.test(new URL(response.url()).pathname)
    if (isSave) statuses.push(response.status())
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

/** 할 일 목록을 받아 그릴 때까지 기다린다. */
async function openTodos(page: Page) {
  await page.goto('/todos')
  await expect(page.getByRole('status')).toContainText('개를 끝냈습니다.')
}

/** 체크박스가 든 할 일 항목 */
function itemOf(page: Page, checkbox: Locator) {
  return page.getByRole('listitem').filter({ has: checkbox })
}

test('페이지 뼈대는 할 일 없이 오고, 브라우저가 가져온 할 일을 만든 순서로 보여 준다', async ({ page }) => {
  const errors = collectErrors(page)

  const response = await page.goto('/todos')

  const html = (await response?.text()) ?? ''
  expect(html).toContain('할 일을 불러오는 중입니다.')
  expect(html).not.toContain('회의록 공유하기')
  await expect(page.getByRole('list', { name: '할 일 목록' }).getByRole('listitem')).toHaveText([
    '디자인 시안 검토하기',
    '회의록 공유하기',
    '배포 일정 정하기',
    REJECTED_TODO,
  ])
  expect(errors).toEqual([])
})

test('체크하면 저장 응답이 오기 전에 바로 바뀌고, 저장하는 동안 저장 중이라고 보여 준다', async ({ page }) => {
  const saves = recordSaveResponses(page)
  await openTodos(page)
  const checkbox = page.getByRole('checkbox', { name: '회의록 공유하기' })
  const saving = itemOf(page, checkbox).getByText('저장 중')
  const before = await checkbox.isChecked()

  await checkbox.click()

  await expect(checkbox).toBeChecked({ checked: !before })
  expect(saves).toEqual([])
  await expect(saving).toBeVisible()
  // 서버가 저장을 받아들이면 그대로다.
  await expect(saving).toBeHidden()
  expect(saves).toEqual([200])
  await expect(checkbox).toBeChecked({ checked: !before })

  // 키보드(Space)로도 바꾼다. 바꾼 값을 되돌려 두어 다음 테스트가 같은 상태에서 시작한다.
  await checkbox.press('Space')

  await expect(checkbox).toBeChecked({ checked: before })
  await expect(saving).toBeHidden()
  expect(saves).toEqual([200, 200])
})

test('서버가 거절하면 바로 바뀌었던 체크가 응답 뒤에 되돌아가고, 무엇을 왜 되돌렸는지 알린다', async ({ page }) => {
  const saves = recordSaveResponses(page)
  await openTodos(page)
  const checkbox = page.getByRole('checkbox', { name: REJECTED_TODO })
  await expect(checkbox).not.toBeChecked()

  await checkbox.press('Space')

  await expect(checkbox).toBeChecked()
  expect(saves).toEqual([])
  await expect(checkbox).not.toBeChecked()
  expect(saves).toEqual([403])
  const toasts = page.getByRole('region', { name: '알림' })
  await expect(toasts.getByText('할 일을 바꾸지 못해 되돌렸습니다')).toBeVisible()
  await expect(toasts.getByText(`${REJECTED_TODO}: ${REJECTED_REASON}`)).toBeVisible()
})

// 운영체제가 다크 모드이면 다크 테마를 더하는 Recipe(dark-mode)와 함께 켠 Starter는 다크 테마로 연다. 그런 Recipe가 없으면
// 두 경우 모두 Base의 테마다.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`운영체제가 ${colorScheme} 모드이면`, () => {
    test.use({ colorScheme })

    test('할 일 페이지에 WCAG 2.2 AA 접근성 위반이 없다(되돌린 뒤의 알림 포함)', async ({ page }) => {
      await openTodos(page)
      await expect(page.getByRole('heading', { level: 1, name: '할 일' })).toBeVisible()
      await page.getByRole('checkbox', { name: REJECTED_TODO }).click()
      await expect(
        page.getByRole('region', { name: '알림' }).getByText('할 일을 바꾸지 못해 되돌렸습니다'),
      ).toBeVisible()

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
      expect(violations).toEqual([])
    })
  })
}
