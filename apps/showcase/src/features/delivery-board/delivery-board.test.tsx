// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/realtime/src/features/delivery-board/delivery-board.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { deliveriesKeys } from '@/queries/deliveries/deliveries.keys'
import { createMockDeliveryBackend } from '@/shared/mocks/deliveries'
import { server } from '@/shared/mocks/node'
import { DeliveryBoard } from './delivery-board'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로, 개발 서버와 E2E처럼 브라우저의 요청을 MSW가 받는
// 빌드를 흉내 낸다(server에서는 쓰이지 않는다). 요청은 Vitest의 MSW(@/shared/mocks/node)가 받는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// 다시 연결하기 전에 기다리는 시간(0.5~1초)보다 넉넉히 기다린다.
const RECONNECT_TIMEOUT = { timeout: 3000 }

/**
 * 테스트마다 새 목 백엔드로 배송 현황을 그린다. 테스트가 백엔드의 이벤트와 연결을 직접 다룬다(개발 서버와 E2E의 목 백엔드는
 * 정해진 순서대로 이벤트를 보낸다).
 */
async function renderDeliveryBoard() {
  const backend = createMockDeliveryBackend()
  server.use(...backend.handlers)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <DeliveryBoard />
    </QueryClientProvider>,
  )
  // 연결되면 연결되기 전에 놓친 이벤트를 맞추려고 목록을 다시 가져오므로, 그것까지 끝나기를 기다린다.
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('실시간 연결됨')
  })
  await waitFor(() => {
    expect(queryClient.isFetching()).toBe(0)
  })
  return { backend, queryClient }
}

/** 표의 본문 행마다 운송장 번호와 상태를 읽는다. */
function deliveryRows(): string[] {
  const [, body] = screen.getAllByRole('rowgroup')
  if (body === undefined) throw new Error('표에 본문이 없습니다.')
  return within(body)
    .getAllByRole('row')
    .map((row) => {
      const cells = within(row).getAllByRole('cell')
      return `${cells[0]?.textContent ?? ''} ${cells.at(-1)?.textContent ?? ''}`
    })
}

test('불러오는 중임을 알린 뒤 최근에 접수한 배송부터 보여 주고, 실시간 연결 상태를 알린다', async () => {
  const backend = createMockDeliveryBackend()
  server.use(...backend.handlers)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DeliveryBoard />
    </QueryClientProvider>,
  )

  expect(screen.getByRole('status')).toHaveTextContent('실시간 연결 중')
  expect(screen.getByText('배송 현황을 불러오는 중입니다.')).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('실시간 연결됨')
  })
  expect(screen.getByRole('table', { name: '배송 목록' })).toBeInTheDocument()
  expect(deliveryRows()).toEqual(['D-1003 상품 준비 중', 'D-1002 상품 준비 중', 'D-1001 배송 중'])
})

test('배송이 바뀌었다는 이벤트를 받으면 목록을 다시 요청하지 않고 쿼리 캐시의 그 배송을 바꾼다', async () => {
  const { backend, queryClient } = await renderDeliveryBoard()
  const requests = backend.listRequests

  backend.publish('delivery.updated', {
    id: 'D-1002',
    recipient: '이도윤',
    item: '블루투스 스피커',
    status: 'shipping',
    updatedAt: '2026-10-21T09:30:00+09:00',
  })

  await waitFor(() => {
    expect(deliveryRows()).toEqual(['D-1003 상품 준비 중', 'D-1002 배송 중', 'D-1001 배송 중'])
  })
  expect(backend.listRequests).toBe(requests)
  expect(queryClient.getQueryData(deliveriesKeys.listDeliveries())).toContainEqual(
    expect.objectContaining({ id: 'D-1002', status: 'shipping' }),
  )
})

test('새 배송을 접수했다는 이벤트를 받으면 목록을 다시 요청하지 않고 맨 앞에 더한다', async () => {
  const { backend } = await renderDeliveryBoard()
  const requests = backend.listRequests

  backend.publish('delivery.created', {
    id: 'D-1004',
    recipient: '최민준',
    item: '노트북 거치대',
    status: 'preparing',
    updatedAt: '2026-10-21T09:40:00+09:00',
  })

  await waitFor(() => {
    expect(deliveryRows()).toEqual([
      'D-1004 상품 준비 중',
      'D-1003 상품 준비 중',
      'D-1002 상품 준비 중',
      'D-1001 배송 중',
    ])
  })
  expect(backend.listRequests).toBe(requests)
})

test('캐시에 있는 것보다 오래된 이벤트는 반영하지 않는다(늦게 도착한 이벤트)', async () => {
  const { backend } = await renderDeliveryBoard()

  backend.publish('delivery.updated', {
    id: 'D-1001',
    recipient: '김하늘',
    item: '무선 이어폰',
    status: 'preparing',
    updatedAt: '2026-10-21T08:00:00+09:00',
  })
  backend.publish('delivery.updated', {
    id: 'D-1003',
    recipient: '박서연',
    item: '무선 키보드',
    status: 'shipping',
    updatedAt: '2026-10-21T09:35:00+09:00',
  })

  await waitFor(() => {
    expect(deliveryRows()).toEqual(['D-1003 배송 중', 'D-1002 상품 준비 중', 'D-1001 배송 중'])
  })
})

test('명세와 다른 이벤트를 받으면 캐시를 고치지 못하므로 목록을 다시 가져와 맞추고, 모르는 이름의 이벤트는 무시한다', async () => {
  const { backend } = await renderDeliveryBoard()
  const requests = backend.listRequests

  backend.send({ event: 'delivery.heartbeat', data: '{}' })
  backend.changeSilently({
    id: 'D-1002',
    recipient: '이도윤',
    item: '블루투스 스피커',
    status: 'delivered',
    updatedAt: '2026-10-21T10:00:00+09:00',
  })
  backend.send({ event: 'delivery.updated', data: '{"id":"D-1002","status":"lost"}' })

  await waitFor(() => {
    expect(deliveryRows()).toEqual(['D-1003 상품 준비 중', 'D-1002 배송 완료', 'D-1001 배송 중'])
  })
  expect(backend.listRequests).toBe(requests + 1)
})

test('연결이 끊기면 다시 연결하는 중임을 알리고, 다시 연결되면 끊긴 동안 놓친 변경을 목록을 다시 가져와 맞춘다', async () => {
  const { backend } = await renderDeliveryBoard()
  const requests = backend.listRequests

  backend.changeSilently({
    id: 'D-1001',
    recipient: '김하늘',
    item: '무선 이어폰',
    status: 'delivered',
    updatedAt: '2026-10-21T09:50:00+09:00',
  })
  backend.disconnect()

  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('연결이 끊겨 다시 연결하는 중')
  })
  expect(deliveryRows()).toEqual(['D-1003 상품 준비 중', 'D-1002 상품 준비 중', 'D-1001 배송 중'])
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('실시간 연결됨')
  }, RECONNECT_TIMEOUT)
  await waitFor(() => {
    expect(deliveryRows()).toEqual(['D-1003 상품 준비 중', 'D-1002 상품 준비 중', 'D-1001 배송 완료'])
  })
  expect(backend.listRequests).toBe(requests + 1)
})

test('목록을 다시 가져오는 동안 이벤트가 오면, 그 응답은 이벤트보다 오래됐을 수 있으므로 이벤트 뒤의 목록으로 다시 맞춘다', async () => {
  const { backend, queryClient } = await renderDeliveryBoard()
  // 목록 응답을 붙잡아 둔다. 응답에는 요청을 받은 때의 목록이 담긴다.
  const resume = backend.holdListResponses()
  const requests = backend.listRequests
  backend.disconnect()
  // 다시 연결한 뒤 맞추려고 보낸 목록 요청이 백엔드에 닿았다(응답은 붙잡혀 있다).
  await waitFor(() => {
    expect(backend.listRequests).toBe(requests + 1)
  }, RECONNECT_TIMEOUT)

  // 그 요청의 응답이 오기 전에 이벤트가 온다.
  backend.publish('delivery.updated', {
    id: 'D-1002',
    recipient: '이도윤',
    item: '블루투스 스피커',
    status: 'shipping',
    updatedAt: '2026-10-21T09:30:00+09:00',
  })
  await waitFor(() => {
    expect(deliveryRows()).toContain('D-1002 배송 중')
  })
  resume()

  await waitFor(() => {
    expect(queryClient.isFetching()).toBe(0)
  })
  expect(deliveryRows()).toEqual(['D-1003 상품 준비 중', 'D-1002 배송 중', 'D-1001 배송 중'])
})

test('처음 목록을 받기 전에 연결되면, 연결되기 전에 보낸 그 요청의 응답 대신 연결된 뒤의 목록으로 맞춘다', async () => {
  const backend = createMockDeliveryBackend()
  server.use(...backend.handlers)
  const resumeList = backend.holdListResponses()
  const acceptConnections = backend.holdConnections()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DeliveryBoard />
    </QueryClientProvider>,
  )
  // 처음 목록 요청이 백엔드에 닿았다(응답은 붙잡혀 있다).
  await waitFor(() => {
    expect(backend.listRequests).toBe(1)
  })

  // 그 요청을 받은 뒤, 연결되기 전에 배송이 바뀐다. 이 변경은 이벤트로 오지 않는다.
  backend.changeSilently({
    id: 'D-1001',
    recipient: '김하늘',
    item: '무선 이어폰',
    status: 'delivered',
    updatedAt: '2026-10-21T09:50:00+09:00',
  })
  acceptConnections()
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('실시간 연결됨')
  })
  // 연결된 뒤에 목록을 다시 요청한다.
  await waitFor(() => {
    expect(backend.listRequests).toBe(2)
  })
  resumeList()

  await waitFor(() => {
    expect(deliveryRows()).toEqual(['D-1003 상품 준비 중', 'D-1002 상품 준비 중', 'D-1001 배송 완료'])
  })
})

test('배송 현황을 가져오지 못하면 불러오지 못했다고 알린다', async () => {
  const backend = createMockDeliveryBackend()
  server.use(
    http.get('*/deliveries', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })),
    ...backend.handlers,
  )

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DeliveryBoard />
    </QueryClientProvider>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('배송 현황을 불러오지 못했습니다.')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
