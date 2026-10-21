// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/realtime/src/queries/deliveries/deliveries.events.ts

import { hashKey, type QueryClient, type QueryKey, useQueryClient } from '@tanstack/react-query'
import { getStreamDeliveryEventsUrl } from '@/shared/api/generated'
import { Delivery } from '@/shared/api/generated/model'
import type { EventStreamStatus, ServerSentEvent } from '@/shared/realtime/event-stream'
import { useEventStream } from '@/shared/realtime/use-event-stream'
import { deliveriesKeys } from './deliveries.keys'
import { listDeliveriesQueryOptions } from './deliveries.queries'

// realtime Recipe: 배송 이벤트 스트림(streamDeliveryEvents)의 이벤트를 deliveries Query Domain의 캐시에 반영한다.
// 이벤트가 바뀐 배송 전체를 담고 오므로 목록을 다시 요청하지 않고 캐시의 그 배송만 고친다(setQueryData). 캐시를 고칠 수 없는
// 때(명세와 다른 이벤트, 연결되기 전이나 끊긴 동안 놓친 이벤트)만 Query Domain을 무효화해(ADR-0008) 백엔드의 목록으로 맞춘다.

/** 캐시에 반영하는 이벤트의 이름. 바뀐 뒤의 Delivery를 데이터로 담는다. 다른 이름의 이벤트는 무시한다. */
const DELIVERY_EVENTS = new Set(['delivery.created', 'delivery.updated'])

/** 이벤트 데이터를 명세의 Delivery로 읽는다. 명세와 다르면 undefined다. */
function parseDelivery(data: string): Delivery | undefined {
  try {
    return Delivery.safeParse(JSON.parse(data)).data
  } catch {
    return undefined
  }
}

/** 목록에 배송을 넣는다. 이미 있으면 바꾸고(목록에 있는 것보다 오래된 이벤트면 그대로 둔다), 없으면 새로 접수한 것이라 맨 앞에 둔다. */
function upsertDelivery(deliveries: Delivery[], delivery: Delivery): Delivery[] {
  const current = deliveries.find(({ id }) => id === delivery.id)
  if (current === undefined) return [delivery, ...deliveries]
  if (Date.parse(current.updatedAt) > Date.parse(delivery.updatedAt)) return deliveries
  return deliveries.map((item) => (item.id === delivery.id ? delivery : item))
}

/**
 * queryKey 아래의 쿼리를 지금부터 다시 가져온다. 가져오는 중인 요청은 지금보다 먼저 보냈으므로 그 사이의 변경을 담지 못했을 수 있어
 * 그 응답을 기다리지 않는다. invalidateQueries는 데이터가 있는 쿼리만 가져오던 요청을 취소하고 다시 보내고, 아직 데이터가 없는
 * (처음 가져오는 중인) 쿼리는 그 요청을 기다리므로, 그런 쿼리는 먼저 취소한다. 연결될 때 부른다.
 */
async function refetchFromNow(queryClient: QueryClient, queryKey: QueryKey): Promise<void> {
  await queryClient.cancelQueries({ queryKey, predicate: (query) => query.state.data === undefined })
  await queryClient.invalidateQueries({ queryKey })
}

/** 가져오는 중인 요청이 끝나면 다시 가져오기로 한 쿼리 키(hashKey). 이벤트가 몰려도 한 번만 다시 가져온다. */
const refetchesAfterFetch = new WeakMap<QueryClient, Set<string>>()

/**
 * queryKey 아래의 쿼리를 이벤트 뒤의 값으로 다시 가져온다. 가져오는 중이면 그 응답은 이벤트보다 먼저 만들어졌을 수 있으므로,
 * 그 요청이 끝난 뒤에 한 번 더 가져온다. 요청을 취소하고 다시 보내지 않는 것은 이벤트가 요청보다 자주 오면 목록을 끝내 받지
 * 못하기 때문이다.
 */
function refetchAfterEvent(queryClient: QueryClient, queryKey: QueryKey): void {
  if (queryClient.isFetching({ queryKey }) === 0) {
    void queryClient.invalidateQueries({ queryKey })
    return
  }
  const queued = refetchesAfterFetch.get(queryClient) ?? new Set<string>()
  refetchesAfterFetch.set(queryClient, queued)
  const hash = hashKey(queryKey)
  if (queued.has(hash)) return
  queued.add(hash)
  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    if (queryClient.isFetching({ queryKey }) > 0) return
    unsubscribe()
    queued.delete(hash)
    void queryClient.invalidateQueries({ queryKey })
  })
}

/** 이벤트 하나를 캐시에 반영한다. */
function applyDeliveryEvent(queryClient: QueryClient, event: ServerSentEvent): void {
  if (!DELIVERY_EVENTS.has(event.event)) return
  const delivery = parseDelivery(event.data)
  if (delivery === undefined) {
    // 무엇이 바뀌었는지 읽을 수 없으므로 Query Domain 전체를 다시 가져온다.
    refetchAfterEvent(queryClient, deliveriesKeys.all)
    return
  }
  const { queryKey } = listDeliveriesQueryOptions()
  // 아직 목록을 받지 않았으면 고칠 것이 없다. 받는 중인 목록은 아래에서 다시 가져온다.
  queryClient.setQueryData(queryKey, (deliveries) => deliveries && upsertDelivery(deliveries, delivery))
  // 목록을 가져오는 중이면 그 응답이 도착해 방금 고친 캐시를 덮어쓸 수 있으므로, 그 뒤에 다시 가져온다.
  if (queryClient.isFetching({ queryKey }) > 0) refetchAfterEvent(queryClient, queryKey)
}

/**
 * 배송 이벤트 스트림에 연결해 이벤트를 deliveries Query Domain의 캐시에 반영하고, 연결 상태를 돌려준다. 배송 목록을 보여 주는
 * 컴포넌트가 함께 부른다. 연결될 때마다(처음 연결 포함) Query Domain을 다시 가져온다. 끊긴 동안이나, 처음 연결되기 전에 보낸 목록
 * 요청 뒤에 일어난 변경은 이벤트로 받지 못하기 때문이다.
 */
export function useDeliveryEvents(): EventStreamStatus {
  const queryClient = useQueryClient()
  return useEventStream(getStreamDeliveryEventsUrl(), {
    onEvent: (event) => {
      applyDeliveryEvent(queryClient, event)
    },
    onOpen: () => {
      void refetchFromNow(queryClient, deliveriesKeys.all)
    },
  })
}
