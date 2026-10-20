// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/route-rendering/src/app/rendering/page.tsx

import type { Metadata } from 'next'
import Link from 'next/link'
import { RENDERING_DEMOS } from '@/features/rendering-demo/rendering-demos'

export const metadata: Metadata = {
  title: '라우트별 Rendering Mode',
}

// route-rendering Recipe: server Starter에서 라우트마다 고르는 Rendering Mode를 데모 페이지 하나씩으로 나란히 보여 준다.
export default function RenderingPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">라우트별 Rendering Mode</h1>
      <p>
        server Starter에서는 라우트마다 Rendering Mode를 고릅니다. 데모 페이지마다 서버가 그 HTML을 렌더링한 시각이
        보이니, 새로고침하며 언제 다시 렌더링하는지 비교해 보세요.
      </p>
      <ul className="flex flex-col gap-2">
        {RENDERING_DEMOS.map((demo) => (
          <li key={demo.path}>
            <Link href={demo.path} className="focus-ring font-semibold underline">
              {demo.name}
            </Link>
            : {demo.summary}
          </li>
        ))}
      </ul>
    </main>
  )
}
