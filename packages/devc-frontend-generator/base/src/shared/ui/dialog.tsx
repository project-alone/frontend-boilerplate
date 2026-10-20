import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cx } from 'class-variance-authority'
import type { WithClassName } from './class-name'

/**
 * 대화상자. 열리면 포커스를 안으로 옮기고 밖으로 나가지 못하게 하며, Esc로 닫히면 포커스를 트리거로 돌려준다.
 *
 * <Dialog>
 *   <DialogTrigger render={<Button />}>열기</DialogTrigger>
 *   <DialogPopup>
 *     <DialogTitle>제목</DialogTitle>
 *     <DialogDescription>설명</DialogDescription>
 *     <DialogClose render={<Button variant="secondary" />}>닫기</DialogClose>
 *   </DialogPopup>
 * </Dialog>
 */
export const Dialog = DialogPrimitive.Root

/** 대화상자를 여는 버튼. 모양은 render prop으로 Button을 넘겨 정한다. */
export const DialogTrigger = DialogPrimitive.Trigger

/** 대화상자를 닫는 버튼. 모양은 render prop으로 Button을 넘겨 정한다. */
export const DialogClose = DialogPrimitive.Close

/** 화면 가운데에 뜨는 대화상자 본체와 그 뒤를 덮는 막 */
export function DialogPopup({ className, ...props }: WithClassName<DialogPrimitive.Popup.Props>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay" />
      <DialogPrimitive.Popup
        className={cx(
          'focus-ring fixed inset-x-4 top-1/2 z-50 mx-auto flex max-w-dialog -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-background p-6 text-foreground',
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({ className, ...props }: WithClassName<DialogPrimitive.Title.Props>) {
  return <DialogPrimitive.Title className={cx('text-lg font-semibold', className)} {...props} />
}

export function DialogDescription({ className, ...props }: WithClassName<DialogPrimitive.Description.Props>) {
  return <DialogPrimitive.Description className={cx('text-md text-muted-foreground', className)} {...props} />
}
