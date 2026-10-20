// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/query-client/query-provider.tsx

'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getQueryClient } from './get-query-client'

/** 클라이언트 컴포넌트가 TanStack Query를 쓸 수 있게 한다. 루트 레이아웃이 앱 전체를 감싼다. */
export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
}
