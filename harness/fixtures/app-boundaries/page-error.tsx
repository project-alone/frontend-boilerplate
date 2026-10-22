'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'

// 하네스(harness/app-boundaries.test.ts)의 탐침 페이지. 버튼을 누르면 브라우저에서 렌더링하다 오류를 던진다. 이 라우트에는
// error.tsx가 없으므로 앱 수준의 오류 화면(src/app/error.tsx)이 받는다.
export default function HarnessPageErrorPage() {
  const [failing, setFailing] = useState(false)
  if (failing) throw new Error('harness-page-error')

  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">페이지 오류 탐침</h1>
      <Button onClick={() => setFailing(true)}>페이지 오류 내기</Button>
    </main>
  )
}
