// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/toast.test.tsx

import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { Button } from './button'
import { ToastProvider, useToast } from './toast'

function SaveButton({ failed = false }: { failed?: boolean }) {
  const toast = useToast()

  return (
    <Button
      onClick={() =>
        toast.add(
          failed
            ? { type: 'error', title: '저장하지 못했습니다', description: '잠시 뒤에 다시 시도해 주세요.' }
            : { title: '저장했습니다', description: '변경한 내용이 반영되었습니다.' },
        )
      }
    >
      저장
    </Button>
  )
}

function renderSaveButton(props: { failed?: boolean } = {}) {
  render(
    <ToastProvider>
      <SaveButton {...props} />
    </ToastProvider>,
  )
}

test('알림은 알림 영역에 나타나고, 키보드로 알림 영역(F6)에 들어가 닫기 버튼으로 닫는다', async () => {
  const user = userEvent.setup()
  renderSaveButton()

  await user.click(screen.getByRole('button', { name: '저장' }))
  const region = screen.getByRole('region', { name: '알림' })
  const title = await within(region).findByText('저장했습니다')
  // 알림은 포털로 문서의 body에 그린다.
  expect(await axeViolations(document.body)).toEqual([])

  await user.keyboard('{F6}')
  await user.click(await within(region).findByRole('button', { name: '닫기' }))
  await waitFor(() => {
    expect(title).not.toBeInTheDocument()
  })
})

test('실패 알림도 알림 영역에 나타나고 접근성 위반이 없다', async () => {
  const user = userEvent.setup()
  renderSaveButton({ failed: true })

  await user.click(screen.getByRole('button', { name: '저장' }))

  expect(await within(screen.getByRole('region', { name: '알림' })).findByText('저장하지 못했습니다')).toBeVisible()
  expect(await axeViolations(document.body)).toEqual([])
})
