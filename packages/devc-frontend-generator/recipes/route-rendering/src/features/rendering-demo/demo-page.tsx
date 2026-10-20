import Link from 'next/link'
import type { ReactNode } from 'react'

/** 라우트별 Rendering Mode 데모 페이지의 틀. 제목, 설명과 데모, 목록으로 돌아가는 링크를 담는다. */
export function DemoPage({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      {children}
      <p>
        <Link href="/rendering" className="focus-ring underline">
          라우트별 Rendering Mode 목록으로
        </Link>
      </p>
    </main>
  )
}
