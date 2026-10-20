import type { Metadata } from 'next'
import { DemoPage } from '@/features/rendering-demo/demo-page'
import { RenderedAt } from '@/features/rendering-demo/rendered-at'

export const metadata: Metadata = {
  title: 'ISR · 라우트별 Rendering Mode',
}

// ISR: 빌드할 때 렌더링해 둔 HTML을 보내다가, 렌더링한 지 revalidate초가 지난 뒤 요청이 오면 뒤에서 다시 렌더링한다.
// Next.js가 빌드할 때 읽으므로 값은 상수로 적는다.
export const revalidate = 10

export default function IsrPage() {
  return (
    <DemoPage title="ISR">
      <p>
        빌드할 때 렌더링한 HTML을 보내다가, 렌더링한 지 10초(<code>revalidate = 10</code>)가 지난 뒤 요청이 오면 그
        요청에는 이전 HTML을 보내고 뒤에서 다시 렌더링합니다. 그다음 요청부터 새 HTML을 받습니다. 10초 넘게 기다렸다가
        두 번 새로고침하면 아래 시각이 바뀝니다. 조금 늦게 반영돼도 되는 목록·상세 화면에 씁니다. 데이터가 바뀐 즉시
        반영하려면 <code>revalidatePath()</code>나 <code>revalidateTag()</code>로 다시 렌더링을 요청합니다.
      </p>
      <RenderedAt />
    </DemoPage>
  )
}
