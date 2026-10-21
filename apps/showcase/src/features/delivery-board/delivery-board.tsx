// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/realtime/src/features/delivery-board/delivery-board.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import { useDeliveryEvents } from '@/queries/deliveries/deliveries.events'
import { listDeliveriesQueryOptions } from '@/queries/deliveries/deliveries.queries'
import type { Delivery, DeliveryStatus } from '@/shared/api/generated/model'
import { ConnectionStatus } from '@/shared/realtime/connection-status'

// realtime Recipe: 배송 현황(listDeliveries)을 보여 주고, 배송 이벤트 스트림으로 바뀐 배송을 곧바로 반영한다.
// 목록은 보통의 쿼리로 가져오고(useQuery), 이벤트는 Query Domain이 캐시에 반영하므로(useDeliveryEvents) 이 컴포넌트는
// 캐시의 목록을 그릴 뿐이다. 다른 화면에 쓰려면 이 파일을 복사해 쿼리와 이벤트 훅, 열을 바꾼다.

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  preparing: '상품 준비 중',
  shipping: '배송 중',
  delivered: '배송 완료',
}

/** 표의 열. 머리글과 배송마다 칸에 보일 글자 */
const COLUMNS: readonly { header: string; cell: (delivery: Delivery) => string }[] = [
  { header: '운송장 번호', cell: (delivery) => delivery.id },
  { header: '받는 사람', cell: (delivery) => delivery.recipient },
  { header: '상품', cell: (delivery) => delivery.item },
  { header: '상태', cell: (delivery) => STATUS_LABELS[delivery.status] },
]

const CELL_CLASS_NAME = 'border-b border-border px-3 py-2'

/** 배송 현황 표와 실시간 연결 상태. 이벤트로 배송이 바뀌거나 더해지면 목록을 다시 요청하지 않고 표가 바뀐다. */
export function DeliveryBoard() {
  const { data: deliveries, isError } = useQuery(listDeliveriesQueryOptions())
  const connection = useDeliveryEvents()

  return (
    <div className="flex flex-col gap-4">
      <ConnectionStatus status={connection} />
      {isError ? (
        <p role="alert">배송 현황을 불러오지 못했습니다.</p>
      ) : deliveries === undefined ? (
        <p>배송 현황을 불러오는 중입니다.</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="mb-2 text-left font-semibold">배송 목록</caption>
          <thead>
            <tr>
              {COLUMNS.map(({ header }) => (
                <th key={header} scope="col" className={`${CELL_CLASS_NAME} text-sm font-medium`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id}>
                {COLUMNS.map(({ header, cell }) => (
                  <td key={header} className={CELL_CLASS_NAME}>
                    {cell(delivery)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
