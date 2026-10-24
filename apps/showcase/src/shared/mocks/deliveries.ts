// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/realtime/src/shared/mocks/deliveries.ts

import { http, type HttpHandler, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import type { Delivery } from '@/shared/api/generated/model'
import { createMockEventStream, type MockEventStream, type MockServerSentEvent } from './event-stream'

// realtime Recipe: 배송 현황 목록(listDeliveries)과 배송 이벤트 스트림(streamDeliveryEvents)을 흉내 내는 목 백엔드.
// 명세에서 생성한 핸들러는 example을 그대로 돌려주므로, 이 핸들러가 그보다 앞에서(확장 지점 mockHandlers, extensions.json) 이벤트로 바뀐 목록을
// 백엔드처럼 돌려준다. 이벤트를 보내면 목록도 함께 바뀌므로, 다시 가져온 목록이 받은 이벤트와 맞는다.
//
// - 테스트(Vitest): createMockDeliveryBackend()로 테스트마다 새 백엔드를 만들어 이벤트와 연결을 직접 다룬다.
// - 개발 서버와 E2E: deliveriesHandlers가 새로 연결한 화면마다 정해진 순서(DEMO_SCENARIO)로 이벤트를 보낸다.

/** 배송 이벤트의 이름(명세의 streamDeliveryEvents) */
type DeliveryEventName = 'delivery.created' | 'delivery.updated'

/** 목 백엔드에 처음 있는 배송. 최근에 접수한 것이 앞이다. */
const INITIAL_DELIVERIES: readonly Delivery[] = [
  {
    id: 'D-1003',
    recipient: '박서연',
    item: '무선 키보드',
    status: 'preparing',
    updatedAt: '2026-10-21T09:20:00+09:00',
  },
  {
    id: 'D-1002',
    recipient: '이도윤',
    item: '블루투스 스피커',
    status: 'preparing',
    updatedAt: '2026-10-21T09:10:00+09:00',
  },
  {
    id: 'D-1001',
    recipient: '김하늘',
    item: '무선 이어폰',
    status: 'shipping',
    updatedAt: '2026-10-21T09:00:00+09:00',
  },
]

/** 목 백엔드에 처음 있는 배송(id)의 상태와 바뀐 시각을 바꾼 배송. 이벤트로 보낼 변경을 만들 때 쓴다. */
export function changedDelivery(id: string, changes: Pick<Delivery, 'status' | 'updatedAt'>): Delivery {
  const delivery = INITIAL_DELIVERIES.find((initial) => initial.id === id)
  if (delivery === undefined) throw new Error(`목 백엔드에 배송 ${id}가 없습니다.`)
  return { ...delivery, ...changes }
}

export interface MockDeliveryBackend {
  /** 목록과 이벤트 스트림의 MSW 핸들러 */
  readonly handlers: readonly HttpHandler[]
  /** 목록을 요청받은 횟수 */
  readonly listRequests: number
  /** 배송을 접수하거나 바꾸고, 열린 스트림 모두에 이벤트로 알린다. */
  publish: (event: DeliveryEventName, delivery: Delivery) => void
  /** 목록은 그대로 두고 열린 스트림 모두에 이벤트를 그대로 보낸다(명세와 다른 이벤트를 흉내 낼 때). */
  send: (event: MockServerSentEvent) => void
  /** 이벤트를 보내지 않고 배송을 바꾼다. 연결이 끊긴 동안 일어나 받는 쪽이 놓친 변경이다. */
  changeSilently: (delivery: Delivery) => void
  /** 백엔드가 연결을 끊은 것처럼 열린 스트림을 모두 닫는다. */
  disconnect: () => void
  /** 처음 목록으로 되돌린다. 열린 스트림은 그대로 둔다. */
  reset: () => void
  /**
   * 목록 응답을 붙잡아 둔다. 붙잡힌 응답에는 요청을 받은 때의 목록이 담기므로, 그 뒤에 바뀐 것보다 오래된 응답이 된다.
   * 돌려준 함수를 부르면 붙잡은 응답을 모두 보내고 다시 바로 답한다.
   */
  holdListResponses: () => () => void
  /** 이벤트 스트림 연결을 붙잡아 둔다. 돌려준 함수를 부르면 붙잡은 연결을 모두 받고 다시 바로 받는다. */
  holdConnections: () => () => void
}

export interface MockDeliveryBackendOptions {
  /** 이벤트 스트림에 새로 연결할 때마다. 다시 연결한 연결이면 lastEventId에 마지막으로 받은 이벤트 id가 온다. */
  onConnect?: (connection: { lastEventId: string | null }) => void
  /** 목록 요청에 답할 때마다(응답을 붙잡아 두었으면 보낼 때) */
  onListResponse?: () => void
}

/** 지나가려는 쪽(요청)을 붙잡아 두는 문. hold가 돌려준 함수를 부르면 붙잡은 쪽을 모두 보내고 다시 열어 둔다. */
function createGate() {
  let waiting: (() => void)[] | undefined
  return {
    pass: async () => {
      const queue = waiting
      if (queue !== undefined) await new Promise<void>((resolve) => queue.push(resolve))
    },
    hold: () => {
      const queue: (() => void)[] = []
      waiting = queue
      return () => {
        waiting = undefined
        for (const resume of queue) resume()
      }
    },
  }
}

export function createMockDeliveryBackend({
  onConnect,
  onListResponse,
}: MockDeliveryBackendOptions = {}): MockDeliveryBackend {
  let deliveries = [...INITIAL_DELIVERIES]
  let listRequests = 0
  let nextEventId = 1
  // 열린 스트림. Node.js의 MSW는 받는 쪽이 끊어도 알리지 않으므로, 이미 끊긴 스트림도 disconnect로 닫을 때까지 남는다.
  let streams: MockEventStream[] = []
  const listGate = createGate()
  const connectionGate = createGate()

  const upsert = (delivery: Delivery) => {
    deliveries = deliveries.some(({ id }) => id === delivery.id)
      ? deliveries.map((current) => (current.id === delivery.id ? delivery : current))
      : [delivery, ...deliveries]
  }
  const send = (event: MockServerSentEvent) => {
    for (const stream of streams) stream.send(event)
  }

  return {
    handlers: [
      http.get(`${MOCK_API_BASE_URL}/deliveries`, async () => {
        listRequests += 1
        const snapshot = deliveries
        await listGate.pass()
        onListResponse?.()
        return HttpResponse.json(snapshot)
      }),
      http.get(`${MOCK_API_BASE_URL}/deliveries/events`, async ({ request }) => {
        await connectionGate.pass()
        onConnect?.({ lastEventId: request.headers.get('last-event-id') })
        const stream = createMockEventStream()
        streams.push(stream)
        return stream.response
      }),
    ],
    get listRequests() {
      return listRequests
    },
    publish: (event, delivery) => {
      upsert(delivery)
      send({ event, data: JSON.stringify(delivery), id: String(nextEventId) })
      nextEventId += 1
    },
    send,
    changeSilently: upsert,
    disconnect: () => {
      for (const stream of streams) stream.close()
      streams = []
    },
    reset: () => {
      deliveries = [...INITIAL_DELIVERIES]
    },
    holdListResponses: listGate.hold,
    holdConnections: connectionGate.hold,
  }
}

/**
 * 개발 서버와 E2E의 목 백엔드가 새로 연결한 화면에 보내는 순서. after는 그 화면이 연결한 뒤 처음으로 목록을 받은 때(연결된 뒤
 * 맞추려고 다시 가져온 목록)부터의 시간(ms)이다. 그래서 목록을 받기 전에 이벤트가 먼저 가지 않는다.
 */
const DEMO_SCENARIO: readonly { after: number; run: (backend: MockDeliveryBackend) => void }[] = [
  {
    after: 1500,
    run: (backend) => {
      backend.publish(
        'delivery.updated',
        changedDelivery('D-1002', { status: 'shipping', updatedAt: '2026-10-21T09:30:00+09:00' }),
      )
    },
  },
  {
    after: 2500,
    run: (backend) => {
      backend.publish('delivery.created', {
        id: 'D-1004',
        recipient: '최민준',
        item: '노트북 거치대',
        status: 'preparing',
        updatedAt: '2026-10-21T09:40:00+09:00',
      })
    },
  },
  {
    // 연결이 끊긴다. 끊기기 직전의 변경은 이벤트로 보내지 못해, 받는 쪽은 다시 연결한 뒤 목록을 다시 가져와야 알 수 있다.
    after: 3500,
    run: (backend) => {
      backend.changeSilently(changedDelivery('D-1001', { status: 'delivered', updatedAt: '2026-10-21T09:50:00+09:00' }))
      backend.disconnect()
    },
  },
]

// 개발 서버와 E2E가 쓰는 목 백엔드. Last-Event-ID 없이 새로 연결하면(새로 연 화면) 처음 목록으로 되돌리고, 그 뒤 처음 목록을
// 받으면 DEMO_SCENARIO를 처음부터 보낸다. 다시 연결한 연결(Last-Event-ID가 있음)에는 이어서 보낼 이벤트가 없다. server에서는
// Next.js 서버 하나가 모든 화면의 요청을 받으므로, 다른 화면이 새로 연결하면 앞 화면의 순서는 멈추고 열린 화면 모두가 새 순서의
// 이벤트를 받는다.
let demoTimers: ReturnType<typeof setTimeout>[] = []
let demoWaitingForList = false
const demoBackend: MockDeliveryBackend = createMockDeliveryBackend({
  onConnect: ({ lastEventId }) => {
    if (lastEventId !== null) return
    for (const timer of demoTimers) clearTimeout(timer)
    demoTimers = []
    demoBackend.reset()
    demoWaitingForList = true
  },
  onListResponse: () => {
    if (!demoWaitingForList) return
    demoWaitingForList = false
    demoTimers = DEMO_SCENARIO.map(({ after, run }) =>
      setTimeout(() => {
        run(demoBackend)
      }, after),
    )
  },
})

export const deliveriesHandlers = demoBackend.handlers
