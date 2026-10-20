import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getUpdateProductMockHandler, getUpdateProductResponseMock } from '@/shared/api/generated/products/products.msw'
import { REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { server } from '@/shared/mocks/node'
import { ToastProvider } from '@/shared/ui/toast'
import { UpdateProductForm } from './update-product-form'

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
        <UpdateProductForm productId={1} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** 폼이 보낸 요청 본문을 모은다. 응답은 생성된 MSW 핸들러가 명세대로 돌려준다. */
function receivedBodies(): unknown[] {
  const bodies: unknown[] = []
  server.use(
    getUpdateProductMockHandler(async ({ request }) => {
      bodies.push(await request.json())
      return getUpdateProductResponseMock()
    }),
  )
  return bodies
}

test('입력한 값을 요청 본문으로 보내고 성공을 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  await user.type(screen.getByRole('textbox', { name: 'name' }), 'a')
  await user.type(screen.getByRole('spinbutton', { name: 'price' }), '0')
  await user.click(screen.getByRole('button', { name: '상품 수정' }))

  expect(await screen.findByText('상품 수정 완료')).toBeInTheDocument()
  expect(bodies).toEqual([{ name: 'a', price: 0 }])
})

test('비워 둔 필수 입력은 보내지 않고, 입력 요소마다 오류를 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  await user.click(screen.getByRole('button', { name: '상품 수정' }))

  // 오류 메시지는 입력 요소의 설명(aria-describedby)으로 읽힌다. 명세의 description이 있는 필드는 그 설명과 함께 읽힌다.
  const requiredError = new RegExp(RegExp.escape(REQUIRED_MESSAGE))
  for (const control of [
    screen.getByRole('textbox', { name: 'name' }),
    screen.getByRole('spinbutton', { name: 'price' }),
  ]) {
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription(requiredError)
  }
  expect(bodies).toEqual([])
})
