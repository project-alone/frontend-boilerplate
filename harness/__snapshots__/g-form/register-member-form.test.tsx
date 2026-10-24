import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getRegisterMemberMockHandler } from '@/shared/api/generated/members/members.msw'
import { MUST_CHECK_MESSAGE, REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { server } from '@/shared/mocks/node'
import { ToastProvider } from '@/shared/ui/toast'
import { RegisterMemberForm } from './register-member-form'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로 그 요청을 MSW가 받도록 켠다. server에서는 이 값을 읽지 않는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderForm() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <RegisterMemberForm />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** 폼이 보낸 요청 본문을 모은다. 응답은 생성된 MSW 핸들러가 명세대로 돌려준다. */
function receivedBodies(): unknown[] {
  const bodies: unknown[] = []
  server.use(
    getRegisterMemberMockHandler(async ({ request }) => {
      bodies.push(await request.json())
    }),
  )
  return bodies
}

test('입력한 값을 요청 본문으로 보내고 성공을 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  await user.type(screen.getByRole('textbox', { name: '이름' }), 'a')
  await user.type(screen.getByRole('textbox', { name: '이메일' }), 'user@example.com')
  await user.type(screen.getByRole('spinbutton', { name: '나이' }), '14')
  await user.type(screen.getByRole('spinbutton', { name: '키' }), '1')
  await user.click(screen.getByRole('combobox', { name: '등급' }))
  await user.click(await screen.findByRole('option', { name: 'basic' }))
  await user.type(screen.getByRole('textbox', { name: '별명' }), 'a')
  await user.click(screen.getByRole('checkbox', { name: '약관에 동의합니다' }))
  await user.click(screen.getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }))
  await user.click(screen.getByRole('checkbox', { name: '마케팅 정보를 받습니다' }))
  await user.click(screen.getByRole('button', { name: '회원 가입' }))

  expect(await screen.findByText('회원 가입 완료')).toBeInTheDocument()
  expect(bodies).toEqual([
    {
      name: 'a',
      email: 'user@example.com',
      age: 14,
      height: 1,
      grade: 'basic',
      nickname: 'a',
      agreed: true,
      privacy: true,
      marketing: true,
    },
  ])
})

test('처음 화면에 접근성 위반이 없다', async () => {
  renderForm()

  expect(await axeViolations(document.body)).toEqual([])
})

test('비워 두거나 체크하지 않은 필수 입력은 보내지 않고, 입력 요소마다 오류를 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  await user.click(screen.getByRole('button', { name: '회원 가입' }))

  // 오류 메시지는 입력 요소의 설명(aria-describedby)으로 읽힌다. 명세의 description이 있는 필드는 그 설명과 함께 읽힌다.
  const requiredError = new RegExp(RegExp.escape(REQUIRED_MESSAGE))
  for (const control of [
    screen.getByRole('textbox', { name: '이름' }),
    screen.getByRole('textbox', { name: '이메일' }),
    screen.getByRole('combobox', { name: '등급' }),
  ]) {
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription(requiredError)
  }
  // 반드시 true여야 하는 체크박스(명세의 const: true, enum: [true])는 체크하라고 알린다.
  const mustCheckError = new RegExp(RegExp.escape(MUST_CHECK_MESSAGE))
  for (const control of [
    screen.getByRole('checkbox', { name: '약관에 동의합니다' }),
    screen.getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }),
  ]) {
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription(mustCheckError)
  }
  expect(bodies).toEqual([])
  expect(await axeViolations(document.body)).toEqual([])
})
