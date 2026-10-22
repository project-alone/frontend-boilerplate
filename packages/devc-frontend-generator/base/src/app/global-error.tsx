'use client'

import AppError, { type AppErrorProps } from './error'
import '@/shared/ui/styles.css'

// 루트 레이아웃(src/app/layout.tsx)에서 난 오류의 화면. 루트 레이아웃을 대신하므로 <html>, <body>, 스타일을 직접 두고, 내용은
// 앱 수준의 오류 화면(error.tsx)을 그린다. 루트 레이아웃의 Provider, 머리글, metadata, <html>에 더한 속성(예: dark-mode Recipe의
// 테마)은 없다. 문서의 언어는 루트 레이아웃의 <html lang>과 맞추고, 클라이언트 컴포넌트라 metadata를 내보낼 수 없어 <title>을 둔다.
export default function GlobalError(props: AppErrorProps) {
  return (
    <html lang="ko">
      <body>
        <title>문제가 생겼습니다</title>
        <AppError {...props} />
      </body>
    </html>
  )
}
