import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import type { WithClassName } from './class-name'

// 모양은 디자인 토큰(tokens.css)으로 만든 유틸리티만 써서 정한다. 모양이 더 필요하면 variants에 변형을 더한다.
export const statusBadgeVariants = cva('rounded-md border p-4 text-md', {
  variants: {
    variant: {
      default: 'border-border bg-background text-foreground',
      muted: 'border-border bg-muted text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export type StatusBadgeProps = WithClassName<ComponentProps<'div'>> & VariantProps<typeof statusBadgeVariants>

/**
 * 공통 UI 컴포넌트. 키보드 조작이나 스크린 리더 지원이 필요한 부품이면 <div> 대신 Base UI(@base-ui/react)의 부품을 감싼다(예: button.tsx).
 */
export function StatusBadge({ variant, className, ...props }: StatusBadgeProps) {
  return <div className={statusBadgeVariants({ variant, className })} {...props} />
}
