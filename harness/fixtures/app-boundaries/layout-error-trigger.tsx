'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'

// 하네스(harness/app-boundaries.test.ts)가 루트 레이아웃(src/app/layout.tsx)에 더하는 탐침. 버튼을 누르면 루트 레이아웃 안,
// 앱 수준의 오류 경계(src/app/error.tsx) 밖에서 렌더링하다 오류를 던지므로 global-error.tsx가 받는다.
export function HarnessLayoutErrorTrigger() {
  const [failing, setFailing] = useState(false)
  if (failing) throw new Error('harness-layout-error')

  return (
    <Button variant="secondary" onClick={() => setFailing(true)}>
      레이아웃 오류 내기
    </Button>
  )
}
