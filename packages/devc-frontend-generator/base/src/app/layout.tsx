import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { QueryProvider } from '@/shared/query-client/query-provider'
import { ToastProvider } from '@/shared/ui/toast'
import '@/shared/ui/styles.css'

export const metadata: Metadata = {
  title: 'Starter',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
