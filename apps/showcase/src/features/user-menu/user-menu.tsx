// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/features/user-menu/user-menu.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { sessionQueryOptions, useLogoutMutation } from '@/queries/auth/auth.queries'
import { ACCOUNT_PATH, LOGIN_PATH } from '@/shared/auth/access-rules'
import { Button, buttonVariants } from '@/shared/ui/button'

/** 로그아웃한 뒤 로그인 페이지로 새로 들어간다. 이전 사용자로 받아 둔 화면과 캐시를 남기지 않는다. */
function goToLoginPage() {
  window.location.assign(LOGIN_PATH)
}

/**
 * 모든 페이지 위의 머리글에 놓이는 사용자 메뉴. 로그인했으면 이름(내 정보로 가는 링크)과 로그아웃 버튼을, 아니면 로그인 링크를
 * 보여 준다. 로그인 여부는 브라우저가 BFF에 물어본다(sessionQueryOptions). 서버가 쿠키를 읽으면 모든 페이지가 요청마다
 * 렌더링되어(SSR) SSG·ISR 페이지를 미리 만들 수 없기 때문이다.
 */
export function UserMenu({ onLoggedOut = goToLoginPage }: Readonly<{ onLoggedOut?: () => void }>) {
  const { data: user, isPending } = useQuery(sessionQueryOptions())
  const logout = useLogoutMutation()

  // 확인하는 동안에는 자리만 차지해 머리글이 흔들리지 않게 한다.
  if (isPending) return <div className="h-control-sm" aria-hidden />

  if (user === undefined || user === null) {
    return (
      <Link href={LOGIN_PATH} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
        로그인
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link href={ACCOUNT_PATH} className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
        {user.name}
      </Link>
      <Button
        variant="secondary"
        size="sm"
        disabled={logout.isPending}
        onClick={() => {
          logout.mutate(undefined, { onSuccess: onLoggedOut })
        }}
      >
        로그아웃
      </Button>
    </div>
  )
}
