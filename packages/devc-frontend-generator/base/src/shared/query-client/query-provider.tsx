'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getQueryClient } from './get-query-client'

/** 클라이언트 컴포넌트가 TanStack Query를 쓸 수 있게 한다. 루트 레이아웃이 앱 전체를 감싼다. */
export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
}
