import type { Metadata } from 'next'
import { connection } from 'next/server'
import { DemoPage } from '@/features/rendering-demo/demo-page'
import { RenderedAt } from '@/features/rendering-demo/rendered-at'

export const metadata: Metadata = {
  title: 'SSR · 라우트별 Rendering Mode',
}

// SSR: 요청마다 서버에서 렌더링한다. connection()을 기다리면 Next.js가 이 라우트를 빌드할 때 미리 렌더링하지 않는다.
// cookies(), headers(), searchParams처럼 요청마다 달라지는 값을 읽어도 같다.
export default async function SsrPage() {
  await connection()

  return (
    <DemoPage title="SSR">
      <p>
        요청이 올 때마다 서버에서 이 페이지를 렌더링합니다. 새로고침할 때마다 아래 시각이 바뀝니다. 라우트에서{' '}
        <code>connection()</code>을 기다리거나 <code>cookies()</code>, <code>headers()</code>, <code>searchParams</code>
        처럼 요청마다 달라지는 값을 읽으면 SSR이 됩니다. 사용자나 요청에 따라 내용이 달라지는 화면에 씁니다.
      </p>
      <RenderedAt />
    </DemoPage>
  )
}
