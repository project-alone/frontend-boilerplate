import type { Metadata } from 'next'
import { DeliveryBoard } from '@/features/delivery-board/delivery-board'

export const metadata: Metadata = {
  title: '실시간 배송 현황',
}

// realtime Recipe: 이벤트 스트림(Server-Sent Events)으로 받은 변경을 쿼리 캐시에 반영하는 배송 현황. 페이지 뼈대는 빌드할 때
// 미리 만들고, 목록과 이벤트 스트림은 브라우저가 연결한다(server는 BFF 프록시, static-export는 백엔드를 직접 부른다).
// 목 API의 경로(/deliveries)와 겹치지 않도록 페이지는 /realtime에 둔다.
export default function RealtimePage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">실시간 배송 현황</h1>
      <DeliveryBoard />
    </main>
  )
}
