import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getUpdateMemberContactMockHandler } from '@/shared/api/generated/members/members.msw'
import { server } from '@/shared/mocks/node'
import { ToastProvider } from '@/shared/ui/toast'
import { UpdateMemberContactForm } from './update-member-contact-form'

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
        <UpdateMemberContactForm />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** 폼이 보낸 요청 본문을 모은다. 응답은 생성된 MSW 핸들러가 명세대로 돌려준다. */
function receivedBodies(): unknown[] {
  const bodies: unknown[] = []
  server.use(
    getUpdateMemberContactMockHandler(async ({ request }) => {
      bodies.push(await request.json())
    }),
  )
  return bodies
}

test('입력한 값을 요청 본문으로 보내고 성공을 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  await user.type(screen.getByRole('textbox', { name: '전화번호' }), 'a')
  await user.type(screen.getByRole('spinbutton', { name: '층' }), '1')
  await user.click(screen.getByRole('combobox', { name: '지역' }))
  await user.click(await screen.findByRole('option', { name: 'seoul' }))
  await user.type(screen.getByRole('textbox', { name: '메모' }), 'a')
  await user.type(screen.getByRole('textbox', { name: '홈페이지' }), 'https://example.com')
  await user.type(screen.getByRole('textbox', { name: '내선 번호' }), 'a')
  await user.click(screen.getByRole('checkbox', { name: '문자를 받습니다' }))
  await user.click(screen.getByRole('button', { name: '연락처 수정' }))

  expect(await screen.findByText('연락처 수정 완료')).toBeInTheDocument()
  expect(bodies).toEqual([
    { phone: 'a', floor: 1, region: 'seoul', memo: 'a', homepage: 'https://example.com', extension: 'a', sms: true },
  ])
})

test('비워 둔 입력은 보내지 않고, null을 받는 필수 필드는 null로 보낸다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  await user.click(screen.getByRole('button', { name: '연락처 수정' }))

  expect(await screen.findByText('연락처 수정 완료')).toBeInTheDocument()
  expect(bodies).toEqual([{ phone: null, floor: null, region: null, sms: false }])
})

test('검증 규칙에 맞지 않는 값은 보내지 않고 오류를 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  const control = screen.getByRole('textbox', { name: '전화번호' })
  await user.type(control, 'aaaaaaaaaaaaaaaaaaaaa')
  await user.click(screen.getByRole('button', { name: '연락처 수정' }))

  expect(control).toHaveAttribute('aria-invalid', 'true')
  // 오류 메시지(Zod의 한국어 메시지)는 입력 요소의 설명(aria-describedby)으로 읽힌다.
  expect(control).toHaveAccessibleDescription()
  expect(bodies).toEqual([])
})
