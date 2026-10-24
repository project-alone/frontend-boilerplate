import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getUpdateMemberProfileMockHandler } from '@/shared/api/generated/members/members.msw'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { server } from '@/shared/mocks/node'
import { ToastProvider } from '@/shared/ui/toast'
import { UpdateMemberProfileForm } from './update-member-profile-form'

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
        <UpdateMemberProfileForm />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** 폼이 보낸 요청 본문을 모은다. 응답은 생성된 MSW 핸들러가 명세대로 돌려준다. */
function receivedBodies(): unknown[] {
  const bodies: unknown[] = []
  server.use(
    getUpdateMemberProfileMockHandler(async ({ request }) => {
      bodies.push(await request.json())
    }),
  )
  return bodies
}

test('입력한 값을 요청 본문으로 보내고 성공을 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  await user.type(screen.getByRole('textbox', { name: '별명' }), 'a')
  await user.click(screen.getByRole('checkbox', { name: '소식 받기' }))
  await user.click(screen.getByRole('button', { name: '내 정보 수정' }))

  expect(await screen.findByText('내 정보 수정 완료')).toBeInTheDocument()
  expect(bodies).toEqual([{ nickname: 'a', newsletter: true }])
})

test('처음 화면에 접근성 위반이 없다', async () => {
  renderForm()

  expect(await axeViolations(document.body)).toEqual([])
})

test('검증 규칙에 맞지 않는 값은 보내지 않고 오류를 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  const control = screen.getByRole('textbox', { name: '별명' })
  await user.type(control, 'aaaaaaaaaaa')
  await user.click(screen.getByRole('button', { name: '내 정보 수정' }))

  expect(control).toHaveAttribute('aria-invalid', 'true')
  // 오류 메시지(Zod의 한국어 메시지)는 입력 요소의 설명(aria-describedby)으로 읽힌다.
  expect(control).toHaveAccessibleDescription()
  expect(bodies).toEqual([])
  expect(await axeViolations(document.body)).toEqual([])
})
