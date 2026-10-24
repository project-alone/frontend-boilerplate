// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/dialog.test.tsx

import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { Button } from './button'
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from './dialog'

function renderDialog({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  render(
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger render={<Button variant="danger" />}>회원 탈퇴</DialogTrigger>
      <DialogPopup>
        <DialogTitle>회원을 탈퇴할까요?</DialogTitle>
        <DialogDescription>탈퇴하면 작성한 글이 모두 지워집니다.</DialogDescription>
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button variant="secondary" />}>취소</DialogClose>
          <DialogClose render={<Button variant="danger" />}>탈퇴</DialogClose>
        </div>
      </DialogPopup>
    </Dialog>,
  )
}

test('키보드로 열면 포커스가 대화상자 안으로 들어가고, Esc로 닫으면 트리거로 돌아온다', async () => {
  const user = userEvent.setup()
  renderDialog()
  const trigger = screen.getByRole('button', { name: '회원 탈퇴' })

  await user.tab()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', { name: '회원을 탈퇴할까요?' })
  expect(dialog).toHaveAccessibleDescription('탈퇴하면 작성한 글이 모두 지워집니다.')
  await waitFor(() => {
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  await user.keyboard('{Escape}')
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  expect(trigger).toHaveFocus()
})

test('연 대화상자에 접근성 위반이 없다', async () => {
  renderDialog({ defaultOpen: true })

  expect(await screen.findByRole('dialog', { name: '회원을 탈퇴할까요?' })).toBeVisible()
  // 대화상자는 포털로 문서의 body에 그린다.
  expect(await axeViolations(document.body)).toEqual([])
})
