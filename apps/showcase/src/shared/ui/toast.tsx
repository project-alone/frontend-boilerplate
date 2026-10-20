// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/toast.tsx

'use client'

import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { Button } from './button'

const toastVariants = cva('flex items-start gap-4 rounded-lg border bg-background p-4 text-foreground', {
  variants: {
    type: {
      default: 'border-border',
      error: 'border-danger',
    },
  },
  defaultVariants: {
    type: 'default',
  },
})

export type ToastType = 'default' | 'error'

export interface ToastOptions {
  title: ReactNode
  description?: ReactNode
  /** 모양을 정한다. 기본값은 'default' */
  type?: ToastType
  /** 저절로 닫히기까지의 시간(ms). 0이면 저절로 닫히지 않는다. 기본값은 5000 */
  timeout?: number
}

/**
 * 알림(토스트)을 띄울 수 있게 한다. 앱 레이아웃(src/app/layout.tsx)과 Storybook이 이미 감싸 두었다.
 * 알림은 "알림" 영역(landmark)에 쌓이고 스크린 리더가 읽어 준다. F6으로 알림 영역으로 이동할 수 있다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastPrimitive.Provider>
      {children}
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          aria-label="알림"
          className="focus-ring fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-toast"
        >
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

/**
 * 알림을 띄우고 닫는다. ToastProvider 안에서만 쓸 수 있다.
 * 예: useToast().add({ title: '저장했습니다' }), 오류는 add({ type: 'error', title: '저장하지 못했습니다' })
 *
 * 알림은 모두 정중하게(polite) 읽힌다. Base UI의 priority: 'high'는 알림을 스크린 리더에서 숨긴 채 포커스할 수 있게 두어
 * 접근성 검사(aria-hidden-focus)에 걸리므로 열어 두지 않았다.
 */
export function useToast() {
  const { add, close } = ToastPrimitive.useToastManager()
  return {
    /** 알림을 띄우고 그 id를 돌려준다. */
    add: (options: ToastOptions) => add(options),
    /** id의 알림을 닫는다. */
    close,
  }
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map((toast) => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      className={toastVariants({ type: toast.type === 'error' ? 'error' : 'default' })}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <ToastPrimitive.Title className="text-md font-semibold" />
        <ToastPrimitive.Description className="text-sm text-muted-foreground" />
      </div>
      {/* Base UI는 알림 영역이 펼쳐지기 전(마우스를 올리거나 키보드로 포커스하기 전)에는 닫기 버튼을 스크린 리더에서 숨긴다.
          숨긴 버튼이 포커스를 받으면 접근성 위반(aria-hidden-focus)이므로, 펼쳐졌을 때만 보이게 한다.
          터치 화면에서는 알림을 밀어서 닫는다. */}
      <span className="hidden in-data-expanded:flex">
        <ToastPrimitive.Close render={<Button variant="secondary" size="sm" />}>닫기</ToastPrimitive.Close>
      </span>
    </ToastPrimitive.Root>
  ))
}
