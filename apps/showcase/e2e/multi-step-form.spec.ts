// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/e2e/multi-step-form.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { REQUIRED_MESSAGE } from '@/shared/form/form-resolver'

// multi-step-form Recipe: 빌드한 앱의 /partners/apply에서 입점 신청서를 단계마다 채워 신청한다. 신청은 브라우저가 보내고
// (server는 BFF 프록시, static-export는 백엔드 주소로 직접), 생성된 MSW 핸들러가 명세의 example(접수 번호 PA-0001)로 답한다.

/** 브라우저가 입점 신청(submitPartnerApplication)을 보낼 때마다 요청 본문을 모은다. */
function recordApplications(page: Page): unknown[] {
  const bodies: unknown[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/partner-applications')) {
      bodies.push(request.postDataJSON())
    }
  })
  return bodies
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

function stepHeading(page: Page, title: string, step: number) {
  return page.getByRole('heading', { level: 2, name: `${title} (4단계 중 ${String(step)}단계)` })
}

async function clickNext(page: Page) {
  await page.getByRole('button', { name: '다음' }).click()
}

/** 첫 화면이 hydration을 마쳐 입력을 받을 수 있을 때까지 기다린다. 미리 렌더링한 HTML에도 첫 단계가 있다. */
async function openForm(page: Page) {
  await page.goto('/partners/apply')
  await expect(page.getByRole('heading', { level: 1, name: '입점 신청' })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

async function fillBusinessStep(page: Page) {
  await page.getByRole('textbox', { name: '상호' }).fill('하늘상회')
  await page.getByRole('textbox', { name: '사업자등록번호' }).fill('123-45-67890')
  await page.getByRole('combobox', { name: '판매 분야' }).click()
  await page.getByRole('option', { name: '리빙' }).click()
}

async function fillContactStep(page: Page) {
  await page.getByRole('textbox', { name: '담당자 이름' }).fill('김하늘')
  await page.getByRole('textbox', { name: '이메일' }).fill('haneul@example.com')
  await page.getByRole('textbox', { name: '연락처' }).fill('010-1234-5678')
}

async function fillPlanStep(page: Page) {
  await page.getByRole('spinbutton', { name: '판매할 상품 수' }).fill('120')
  await page.getByRole('spinbutton', { name: '월 예상 매출(만 원)' }).fill('300')
  await page.getByRole('checkbox', { name: '입점 약관에 동의합니다' }).click()
}

test('세 단계를 채우고 확인 단계에서 신청하면 모든 입력을 요청 하나로 보내고, 단계를 옮길 때마다 제목으로 포커스가 간다', async ({
  page,
}) => {
  const errors = collectErrors(page)
  const applications = recordApplications(page)
  const response = await page.goto('/partners/apply')
  // 미리 렌더링한 HTML에는 첫 단계가 담긴다.
  expect((await response?.text()) ?? '').toContain('사업자 정보')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('list', { name: '입점 신청 단계' }).getByRole('listitem').first()).toHaveAttribute(
    'aria-current',
    'step',
  )

  await fillBusinessStep(page)
  await clickNext(page)
  await expect(stepHeading(page, '담당자 정보', 2)).toBeFocused()
  await fillContactStep(page)
  await clickNext(page)
  await expect(stepHeading(page, '판매 계획', 3)).toBeFocused()
  await fillPlanStep(page)
  await clickNext(page)
  await expect(stepHeading(page, '신청 내용 확인', 4)).toBeFocused()
  await expect(page.getByRole('region', { name: '판매 계획' })).toContainText('300만 원')
  expect(applications).toEqual([])

  await page.getByRole('button', { name: '신청하기' }).click()

  await expect(page.getByText('입점 신청 완료')).toBeVisible()
  await expect(page.getByText('접수 번호 PA-0001')).toBeVisible()
  expect(applications).toEqual([
    {
      companyName: '하늘상회',
      businessNumber: '123-45-67890',
      category: 'living',
      contactName: '김하늘',
      email: 'haneul@example.com',
      phone: '010-1234-5678',
      productCount: 120,
      monthlySales: 300,
      agreedToTerms: true,
    },
  ])
  await expect(stepHeading(page, '사업자 정보', 1)).toBeFocused()
  await expect(page.getByRole('textbox', { name: '상호' })).toHaveValue('')
  expect(errors).toEqual([])
})

test('다음을 누르면 지금 단계의 필드만 검증해 오류를 알리고 첫 오류 필드로 포커스를 옮긴다', async ({ page }) => {
  await openForm(page)

  await clickNext(page)

  const companyName = page.getByRole('textbox', { name: '상호' })
  await expect(companyName).toHaveAttribute('aria-invalid', 'true')
  await expect(companyName).toBeFocused()
  await expect(companyName).toHaveAccessibleDescription(REQUIRED_MESSAGE)
  await expect(stepHeading(page, '사업자 정보', 1)).toBeVisible()

  // 키보드만으로 고쳐 입력하고 다음으로 간다. Select는 화살표 키로 고른다.
  await page.keyboard.type('하늘상회')
  await page.keyboard.press('Tab')
  await page.keyboard.type('123-45-6789')
  await page.keyboard.press('Tab')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: '패션' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: '판매 분야' })).toHaveText('패션')
  await clickNext(page)

  // 사업자등록번호의 형식이 틀렸다. 맞는 필드는 오류를 지운다.
  const businessNumber = page.getByRole('textbox', { name: '사업자등록번호' })
  await expect(businessNumber).toHaveAttribute('aria-invalid', 'true')
  await expect(businessNumber).toBeFocused()
  await expect(companyName).not.toHaveAttribute('aria-invalid', 'true')
  await businessNumber.fill('123-45-67890')
  await clickNext(page)

  await expect(stepHeading(page, '담당자 정보', 2)).toBeFocused()
  await expect(page.getByRole('textbox', { name: '담당자 이름' })).not.toHaveAttribute('aria-invalid', 'true')
})

test('이전·다음으로 오가도, 페이지를 새로 고쳐도 입력한 값이 남는다', async ({ page }) => {
  await openForm(page)
  await fillBusinessStep(page)
  await clickNext(page)
  await page.getByRole('textbox', { name: '담당자 이름' }).fill('김하늘')

  await page.getByRole('button', { name: '이전' }).click()

  await expect(stepHeading(page, '사업자 정보', 1)).toBeFocused()
  await expect(page.getByRole('textbox', { name: '상호' })).toHaveValue('하늘상회')
  await expect(page.getByRole('combobox', { name: '판매 분야' })).toHaveText('리빙')
  await clickNext(page)
  await expect(page.getByRole('textbox', { name: '담당자 이름' })).toHaveValue('김하늘')
  await page.getByRole('textbox', { name: '이메일' }).fill('haneul@example.com')

  await page.reload()

  // 새로 고치면 입력하던 단계와 값을 이어서 보여 준다(sessionStorage).
  await expect(stepHeading(page, '담당자 정보', 2)).toBeVisible()
  await expect(page.getByRole('textbox', { name: '담당자 이름' })).toHaveValue('김하늘')
  await expect(page.getByRole('textbox', { name: '이메일' })).toHaveValue('haneul@example.com')
  await page.getByRole('button', { name: '이전' }).click()
  await expect(page.getByRole('textbox', { name: '사업자등록번호' })).toHaveValue('123-45-67890')
})

// dark-mode Recipe를 함께 넣은 Starter에서는 운영체제가 다크 모드이면 다크 테마로 연다. 그런 Recipe가 없으면 두 경우 모두
// Base의 테마다.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`운영체제가 ${colorScheme === 'light' ? '라이트' : '다크'} 모드이면`, () => {
    test.use({ colorScheme })

    test('검증 오류를 보이는 단계와 확인 단계에 WCAG 2.2 AA 접근성 위반이 없다', async ({ page }) => {
      await openForm(page)
      await clickNext(page)
      await expect(page.getByRole('textbox', { name: '상호' })).toHaveAttribute('aria-invalid', 'true')

      expect((await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()).violations).toEqual([])

      await fillBusinessStep(page)
      await clickNext(page)
      await fillContactStep(page)
      await clickNext(page)
      await fillPlanStep(page)
      await clickNext(page)
      await expect(stepHeading(page, '신청 내용 확인', 4)).toBeFocused()

      expect((await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()).violations).toEqual([])
    })
  })
}
