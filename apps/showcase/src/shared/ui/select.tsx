// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/select.tsx

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cx } from 'class-variance-authority'
import { type ReactNode, useId } from 'react'
import { formControlClassName, formLabelClassName } from './field'
import { CheckIcon, ChevronDownIcon } from './icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export type SelectProps = Omit<SelectPrimitive.Root.Props<string>, 'items' | 'multiple' | 'children'> & {
  /** 화면에 보이는 레이블. 선택 버튼의 접근 가능한 이름이 된다. */
  label: ReactNode
  options: readonly SelectOption[]
  /** 아무것도 고르지 않았을 때 보이는 문구 */
  placeholder?: string
  /**
   * 있으면 목록 맨 앞에 이 문구(예: "선택 안 함")로 값을 비우는 선택지를 둔다. 고르면 값이 null이 된다. 고른 값을 다시 비울 수
   * 있어야 하는 Select(null을 받는 폼 필드 등)에 쓴다. 아무것도 고르지 않았을 때는 placeholder 대신 이 문구가 보인다.
   */
  clearLabel?: string
  className?: string
}

/** 목록에서 값 하나를 고른다. 키보드(화살표, Enter, 글자 입력)로도 고를 수 있다. */
export function Select({ label, options, placeholder, clearLabel, className, ...props }: SelectProps) {
  const items = clearLabel === undefined ? options : [{ value: null, label: clearLabel }, ...options]
  // 선택 버튼의 접근 가능한 이름이 되는 레이블. Base UI는 hydration 뒤에야 버튼을 레이블에 잇므로(aria-labelledby), 서버가 그린
  // HTML에서도 이름이 있도록 레이블의 글자에 id를 붙여 직접 잇는다.
  const labelId = useId()
  return (
    <SelectPrimitive.Root items={items} {...props}>
      <div className={cx('flex flex-col gap-1', className)}>
        <SelectPrimitive.Label className={formLabelClassName}>
          <span id={labelId}>{label}</span>
        </SelectPrimitive.Label>
        <SelectPrimitive.Trigger
          aria-labelledby={labelId}
          className={cx(formControlClassName, 'flex items-center justify-between gap-2 select-none')}
        >
          <SelectPrimitive.Value
            className="truncate data-placeholder:text-muted-foreground"
            placeholder={placeholder}
          />
          <SelectPrimitive.Icon className="flex">
            <ChevronDownIcon />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
      </div>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-50 outline-none" sideOffset={4} alignItemWithTrigger={false}>
          <SelectPrimitive.Popup className="min-w-(--anchor-width) rounded-lg border border-border bg-background p-1 text-foreground outline-none">
            <SelectPrimitive.List className="max-h-(--available-height) overflow-y-auto">
              {clearLabel !== undefined && <SelectItem value={null} label={clearLabel} />}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} label={option.label} disabled={option.disabled} />
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

/** 목록의 선택지 하나. value가 null이면 값을 비우는 선택지다. */
function SelectItem({
  value,
  label,
  disabled = false,
}: {
  value: string | null
  label: string
  disabled?: boolean | undefined
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      // 키보드로 가리킨 항목은 포커스 링 대신 배경과 글자색을 바꿔 드러낸다.
      className="relative flex cursor-default items-center rounded-sm py-2 pr-3 pl-8 text-md outline-none select-none data-disabled:opacity-50 data-highlighted:bg-primary data-highlighted:text-primary-foreground"
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 flex">
        <CheckIcon />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}
