// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/route-rendering/src/app/rendering/ssg/page.tsx

import type { Metadata } from 'next'
import { DemoPage } from '@/features/rendering-demo/demo-page'
import { RenderedAt } from '@/features/rendering-demo/rendered-at'

export const metadata: Metadata = {
  title: 'SSG · 라우트별 Rendering Mode',
}

// SSG: 요청마다 달라지는 값을 읽지 않는 라우트는 Next.js가 빌드할 때 렌더링해 둔다.
// 'error'는 이 라우트가 요청마다 달라지는 값을 읽으면 SSR로 바뀌는 대신 빌드를 실패시켜, SSG임을 지킨다.
export const dynamic = 'error'

export default function SsgPage() {
  return (
    <DemoPage title="SSG">
      <p>
        <code>npm run build</code>가 빌드할 때 한 번 렌더링해 둔 HTML을 모든 요청에 그대로 보냅니다. 새로고침해도 아래
        시각은 빌드한 시각에서 바뀌지 않습니다. 요청마다 달라지는 값을 읽지 않는 라우트는 따로 정하지 않아도 SSG가 되고,
        이 라우트는 <code>dynamic = &apos;error&apos;</code>로 실수로 그런 값을 읽으면 빌드가 실패하게 했습니다. 배포할
        때만 내용이 바뀌는 화면(소개, 약관 등)에 씁니다.
      </p>
      <RenderedAt />
    </DemoPage>
  )
}
