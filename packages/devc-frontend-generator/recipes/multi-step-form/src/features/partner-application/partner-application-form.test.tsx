import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { userEvent, type UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getSubmitPartnerApplicationMockHandler } from '@/shared/api/generated/partners/partners.msw'
import { MUST_CHECK_MESSAGE, REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { server } from '@/shared/mocks/node'
import { ToastProvider } from '@/shared/ui/toast'
import { PartnerApplicationForm } from './partner-application-form'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로 그 요청을 MSW가 받도록 켠다. server에서는 이 값을 읽지 않는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
  sessionStorage.clear()
})

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <PartnerApplicationForm />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** 지금 단계의 제목(h2). 단계를 옮기면 포커스가 이 제목으로 간다. */
function stepHeading(title: string, step: number) {
  return screen.getByRole('heading', { level: 2, name: `${title} (4단계 중 ${String(step)}단계)` })
}

const requiredError = new RegExp(RegExp.escape(REQUIRED_MESSAGE))

/** 폼이 보낸 요청 본문을 모은다. 응답은 생성된 MSW 핸들러가 명세의 example(접수 번호 PA-0001)으로 돌려준다. */
function receivedBodies(): unknown[] {
  const bodies: unknown[] = []
  server.use(
    getSubmitPartnerApplicationMockHandler(async ({ request }) => {
      bodies.push(await request.json())
      return { id: 'PA-0001' }
    }),
  )
  return bodies
}

async function clickNext(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: '다음' }))
}

async function fillBusinessStep(user: UserEvent) {
  await user.type(screen.getByRole('textbox', { name: '상호' }), '하늘상회')
  await user.type(screen.getByRole('textbox', { name: '사업자등록번호' }), '123-45-67890')
  await user.click(screen.getByRole('combobox', { name: '판매 분야' }))
  await user.click(await screen.findByRole('option', { name: '리빙' }))
}

test('첫 단계(사업자 정보)에서 시작하고, 단계 표시가 지금 단계를 알린다', () => {
  renderForm()

  expect(stepHeading('사업자 정보', 1)).toBeInTheDocument()
  const steps = within(screen.getByRole('list', { name: '입점 신청 단계' })).getAllByRole('listitem')
  expect(steps.map((step) => step.textContent)).toEqual([
    '1사업자 정보',
    '2담당자 정보',
    '3판매 계획',
    '4신청 내용 확인',
  ])
  expect(steps[0]).toHaveAttribute('aria-current', 'step')
  expect(steps.slice(1).filter((step) => step.hasAttribute('aria-current'))).toEqual([])
  expect(screen.queryByRole('button', { name: '이전' })).not.toBeInTheDocument()
})

test('비워 두고 다음을 누르면 이 단계의 필드만 검증해 오류를 알리고, 첫 오류 필드로 포커스를 옮긴다', async () => {
  const user = userEvent.setup()
  renderForm()

  await user.click(screen.getByRole('button', { name: '다음' }))

  const companyName = screen.getByRole('textbox', { name: '상호' })
  for (const control of [
    companyName,
    screen.getByRole('textbox', { name: '사업자등록번호' }),
    screen.getByRole('combobox', { name: '판매 분야' }),
  ]) {
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription(requiredError)
  }
  expect(companyName).toHaveFocus()
  expect(stepHeading('사업자 정보', 1)).toBeInTheDocument()
})

test('이 단계를 바르게 채우고 다음을 누르면 다음 단계로 가고, 포커스가 그 단계의 제목으로 옮겨 지금 단계를 알린다', async () => {
  const user = userEvent.setup()
  renderForm()

  await fillBusinessStep(user)
  await user.click(screen.getByRole('button', { name: '다음' }))

  const heading = await screen.findByRole('heading', { level: 2, name: '담당자 정보 (4단계 중 2단계)' })
  expect(heading).toHaveFocus()
  const steps = within(screen.getByRole('list', { name: '입점 신청 단계' })).getAllByRole('listitem')
  expect(steps[1]).toHaveAttribute('aria-current', 'step')
  expect(steps[0]).toHaveTextContent('완료')
  // 다음 단계의 필드는 아직 입력하지 않았지만 오류를 알리지 않는다.
  expect(screen.getByRole('textbox', { name: '담당자 이름' })).not.toHaveAttribute('aria-invalid')
})

async function fillContactStep(user: UserEvent) {
  await user.type(screen.getByRole('textbox', { name: '담당자 이름' }), '김하늘')
  await user.type(screen.getByRole('textbox', { name: '이메일' }), 'haneul@example.com')
  await user.type(screen.getByRole('textbox', { name: '연락처' }), '010-1234-5678')
}

async function fillPlanStep(user: UserEvent) {
  await user.type(screen.getByRole('spinbutton', { name: '판매할 상품 수' }), '120')
  await user.click(screen.getByRole('checkbox', { name: '입점 약관에 동의합니다' }))
}

/** 세 단계를 모두 채워 확인 단계까지 간다. 선택 필드(월 예상 매출, 회사 소개)는 비워 둔다. */
async function fillUntilReview(user: UserEvent) {
  await fillBusinessStep(user)
  await clickNext(user)
  await fillContactStep(user)
  await clickNext(user)
  await fillPlanStep(user)
  await clickNext(user)
  await screen.findByRole('heading', { level: 2, name: '신청 내용 확인 (4단계 중 4단계)' })
}

/** 확인 단계의 한 묶음(예: 사업자 정보)을 [항목, 값] 쌍으로 읽는다. */
function reviewSection(title: string): [string, string][] {
  const section = screen.getByRole('region', { name: title })
  const terms = within(section).getAllByRole('term')
  return terms.map((term) => [term.textContent, term.nextElementSibling?.textContent ?? ''])
}

test('이전으로 돌아가도 입력한 값이 남고, 돌아간 단계에서 다시 다음으로 가도 다음 단계의 값이 남는다', async () => {
  const user = userEvent.setup()
  renderForm()
  await fillBusinessStep(user)
  await clickNext(user)
  // 다 채우지 않은 단계에서도 이전으로 돌아갈 수 있다. 검증하지 않고, 입력하던 값은 남긴다.
  await user.type(screen.getByRole('textbox', { name: '담당자 이름' }), '김하늘')
  await user.type(screen.getByRole('textbox', { name: '이메일' }), 'haneul@')

  await user.click(screen.getByRole('button', { name: '이전' }))

  expect(stepHeading('사업자 정보', 1)).toHaveFocus()
  expect(screen.getByRole('textbox', { name: '상호' })).toHaveValue('하늘상회')
  expect(screen.getByRole('textbox', { name: '사업자등록번호' })).toHaveValue('123-45-67890')
  expect(screen.getByRole('combobox', { name: '판매 분야' })).toHaveTextContent('리빙')

  await clickNext(user)

  expect(screen.getByRole('textbox', { name: '담당자 이름' })).toHaveValue('김하늘')
  expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('haneul@')
  expect(screen.getByRole('textbox', { name: '이메일' })).not.toHaveAttribute('aria-invalid')
})

test('확인 단계는 모든 단계에서 입력한 값을 보여 주고, 신청하기를 누르면 모든 값을 요청 본문 하나로 한 번 보내고 성공을 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()
  await fillUntilReview(user)

  expect(reviewSection('사업자 정보')).toEqual([
    ['상호', '하늘상회'],
    ['사업자등록번호', '123-45-67890'],
    ['판매 분야', '리빙'],
  ])
  expect(reviewSection('담당자 정보')).toEqual([
    ['담당자 이름', '김하늘'],
    ['이메일', 'haneul@example.com'],
    ['연락처', '010-1234-5678'],
  ])
  expect(reviewSection('판매 계획')).toEqual([
    ['판매할 상품 수', '120개'],
    ['월 예상 매출', '입력하지 않음'],
    ['회사 소개', '입력하지 않음'],
    ['입점 약관', '동의함'],
  ])
  expect(bodies).toEqual([])

  await user.click(screen.getByRole('button', { name: '신청하기' }))

  expect(await screen.findByText('입점 신청 완료')).toBeInTheDocument()
  expect(screen.getByText('접수 번호 PA-0001')).toBeInTheDocument()
  // 비워 둔 선택 필드는 보내지 않는다.
  expect(bodies).toEqual([
    {
      companyName: '하늘상회',
      businessNumber: '123-45-67890',
      category: 'living',
      contactName: '김하늘',
      email: 'haneul@example.com',
      phone: '010-1234-5678',
      productCount: 120,
      agreedToTerms: true,
    },
  ])
  // 성공하면 처음 단계로 돌아가 폼을 비운다.
  expect(stepHeading('사업자 정보', 1)).toHaveFocus()
  expect(screen.getByRole('textbox', { name: '상호' })).toHaveValue('')
})

test('판매 계획 단계는 약관에 동의하지 않았거나 상품 수가 범위를 벗어나면 넘어가지 않고, 비워 둔 선택 필드는 검증하지 않는다', async () => {
  const user = userEvent.setup()
  renderForm()
  await fillBusinessStep(user)
  await clickNext(user)
  await fillContactStep(user)
  await clickNext(user)

  await user.type(screen.getByRole('spinbutton', { name: '판매할 상품 수' }), '0')
  await clickNext(user)

  const productCount = screen.getByRole('spinbutton', { name: '판매할 상품 수' })
  expect(productCount).toHaveAttribute('aria-invalid', 'true')
  expect(productCount).toHaveFocus()
  expect(screen.getByRole('checkbox', { name: '입점 약관에 동의합니다' })).toHaveAccessibleDescription(
    MUST_CHECK_MESSAGE,
  )
  expect(screen.getByRole('spinbutton', { name: '월 예상 매출(만 원)' })).not.toHaveAttribute('aria-invalid')
  expect(screen.getByRole('textbox', { name: '회사 소개' })).not.toHaveAttribute('aria-invalid')
  expect(stepHeading('판매 계획', 3)).toBeInTheDocument()
})

test('확인 단계의 수정 버튼은 그 단계로 돌아가고, 다음을 눌러 다시 확인 단계로 오면 고친 값을 보여 준다', async () => {
  const user = userEvent.setup()
  renderForm()
  await fillUntilReview(user)

  await user.click(screen.getByRole('button', { name: '담당자 정보 수정' }))

  expect(stepHeading('담당자 정보', 2)).toHaveFocus()
  const email = screen.getByRole('textbox', { name: '이메일' })
  expect(email).toHaveValue('haneul@example.com')
  await user.clear(email)
  await user.type(email, 'sky@example.com')
  await clickNext(user)
  await clickNext(user)

  expect(stepHeading('신청 내용 확인', 4)).toHaveFocus()
  expect(reviewSection('담당자 정보')).toContainEqual(['이메일', 'sky@example.com'])
})

test('신청이 실패하면 실패를 알리고, 확인 단계에 입력한 값을 그대로 둬 다시 신청할 수 있다', async () => {
  const user = userEvent.setup()
  server.use(http.post('*/partner-applications', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })))
  renderForm()
  await fillUntilReview(user)

  await user.click(screen.getByRole('button', { name: '신청하기' }))

  expect(await screen.findByText('입점 신청 실패')).toBeInTheDocument()
  expect(stepHeading('신청 내용 확인', 4)).toBeInTheDocument()
  expect(reviewSection('사업자 정보')).toContainEqual(['상호', '하늘상회'])

  const bodies = receivedBodies()
  await user.click(screen.getByRole('button', { name: '신청하기' }))

  expect(await screen.findByText('입점 신청 완료')).toBeInTheDocument()
  expect(bodies).toHaveLength(1)
})

test('신청하는 동안에는 다른 단계로 가거나 다시 신청할 수 없다(돌아가 고친 값은 보낸 요청에 담기지 않는다)', async () => {
  const user = userEvent.setup()
  // 응답을 붙잡아 둔다. release를 부르면 응답한다.
  const { promise: responded, resolve: release } = Promise.withResolvers<undefined>()
  server.use(
    http.post('*/partner-applications', async () => {
      await responded
      return HttpResponse.json({ id: 'PA-0001' }, { status: 201 })
    }),
  )
  renderForm()
  await fillUntilReview(user)

  await user.click(screen.getByRole('button', { name: '신청하기' }))

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '신청하기' })).toBeDisabled()
  })
  expect(screen.getByRole('button', { name: '이전' })).toBeDisabled()
  for (const title of ['사업자 정보', '담당자 정보', '판매 계획']) {
    expect(screen.getByRole('button', { name: `${title} 수정` })).toBeDisabled()
  }

  release(undefined)

  expect(await screen.findByText('입점 신청 완료')).toBeInTheDocument()
})

test('페이지를 새로 고쳐도(sessionStorage) 입력하던 단계와 값을 이어서 보여 주고, 신청에 성공하면 저장한 값을 지운다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  const first = renderForm()
  await fillBusinessStep(user)
  await clickNext(user)
  await user.type(screen.getByRole('textbox', { name: '담당자 이름' }), '김하늘')

  // 새로 고침: 폼을 지우고 다시 그린다. 처음 그린 뒤에 저장한 값을 읽어 이어 간다.
  first.unmount()
  renderForm()

  const heading = await screen.findByRole('heading', { level: 2, name: '담당자 정보 (4단계 중 2단계)' })
  // 이어서 보여 줄 때는 포커스를 옮기지 않는다.
  expect(heading).not.toHaveFocus()
  expect(screen.getByRole('textbox', { name: '담당자 이름' })).toHaveValue('김하늘')
  await user.type(screen.getByRole('textbox', { name: '이메일' }), 'haneul@example.com')
  await user.type(screen.getByRole('textbox', { name: '연락처' }), '010-1234-5678')
  await clickNext(user)
  await fillPlanStep(user)
  await clickNext(user)
  expect(reviewSection('사업자 정보')).toContainEqual(['상호', '하늘상회'])

  await user.click(screen.getByRole('button', { name: '신청하기' }))
  await screen.findByText('입점 신청 완료')
  expect(bodies).toHaveLength(1)

  cleanup()
  renderForm()

  expect(stepHeading('사업자 정보', 1)).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '상호' })).toHaveValue('')
})

test('저장한 값이 지금 명세의 규칙에 맞지 않으면(다른 버전의 앱이 저장 등) 신청하지 않고, 맞지 않는 값이 있는 단계로 돌아가 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  sessionStorage.setItem(
    'partner-application-draft',
    JSON.stringify({
      step: 3,
      values: {
        companyName: '하늘상회',
        businessNumber: '123-45-67890',
        category: 'living',
        contactName: '김하늘',
        email: '이메일 아님',
        phone: '010-1234-5678',
        productCount: 120,
        agreedToTerms: true,
        // 입력 요소에 넣을 수 없는 값은 읽지 않는다.
        introduction: { text: '객체' },
      },
    }),
  )
  renderForm()
  await screen.findByRole('heading', { level: 2, name: '신청 내용 확인 (4단계 중 4단계)' })
  expect(reviewSection('판매 계획')).toContainEqual(['회사 소개', '입력하지 않음'])

  await user.click(screen.getByRole('button', { name: '신청하기' }))

  const email = await screen.findByRole('textbox', { name: '이메일' })
  expect(stepHeading('담당자 정보', 2)).toBeInTheDocument()
  await waitFor(() => {
    expect(email).toHaveAttribute('aria-invalid', 'true')
  })
  expect(email).toHaveFocus()
  expect(bodies).toEqual([])
})
