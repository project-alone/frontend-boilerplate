import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { SESSION_API_PATH } from '@/shared/auth/auth-client'
import { REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { server } from '@/shared/mocks/node'
import { LoginForm } from './login-form'

const USER = { id: 1, email: 'user@example.com', name: '김사용', roles: ['user'] }

function renderForm() {
  const onLoggedIn = vi.fn<(path: string) => void>()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginForm returnPath="/account" onLoggedIn={onLoggedIn} />
    </QueryClientProvider>,
  )
  return { onLoggedIn }
}

/** 로그인 Route Handler가 받은 요청 본문을 모으고 status로 답한다. */
function sessionRoute(status: number): unknown[] {
  const bodies: unknown[] = []
  server.use(
    http.post(`*${SESSION_API_PATH}`, async ({ request }) => {
      bodies.push(await request.json())
      return status === 200
        ? HttpResponse.json({ user: USER })
        : HttpResponse.json({ message: '이메일이나 비밀번호가 맞지 않습니다.' }, { status })
    }),
  )
  return bodies
}

async function submit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: '이메일' }), email)
  await user.type(screen.getByLabelText('비밀번호'), password)
  await user.click(screen.getByRole('button', { name: '로그인' }))
}

test('이메일과 비밀번호를 BFF의 로그인 Route Handler로 보내고, 로그인하면 돌아갈 주소로 간다', async () => {
  const bodies = sessionRoute(200)
  const { onLoggedIn } = renderForm()

  await submit('user@example.com', 'password')

  await vi.waitFor(() => {
    expect(onLoggedIn).toHaveBeenCalledWith('/account')
  })
  expect(bodies).toEqual([{ email: 'user@example.com', password: 'password' }])
})

test('이메일이나 비밀번호가 맞지 않으면 알리고 돌아가지 않는다', async () => {
  sessionRoute(401)
  const { onLoggedIn } = renderForm()

  await submit('user@example.com', 'wrong-password')

  expect(await screen.findByRole('alert')).toHaveTextContent('이메일이나 비밀번호가 맞지 않습니다.')
  expect(onLoggedIn).not.toHaveBeenCalled()
})

test('비워 둔 입력은 보내지 않고, 입력 요소마다 오류를 알린다', async () => {
  const bodies = sessionRoute(200)
  renderForm()

  await userEvent.setup().click(screen.getByRole('button', { name: '로그인' }))

  const requiredError = new RegExp(RegExp.escape(REQUIRED_MESSAGE))
  for (const control of [screen.getByRole('textbox', { name: '이메일' }), screen.getByLabelText('비밀번호')]) {
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription(requiredError)
  }
  expect(bodies).toEqual([])
})
