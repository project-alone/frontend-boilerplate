// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/file-upload/src/features/file-uploader/file-uploader.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { server } from '@/shared/mocks/node'
import { UPLOAD_MAX_BYTES } from '@/shared/upload/upload-policy'
import { FileUploader } from './file-uploader'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로, 개발 서버와 E2E처럼 브라우저의 요청을 MSW가 받는
// 빌드를 흉내 낸다(server에서는 쓰이지 않는다). 업로드에는 file-upload Recipe의 MSW 핸들러(src/shared/mocks/files.ts)가 답한다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderFileUploader() {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <FileUploader />
    </QueryClientProvider>,
  )
}

/**
 * 업로드 요청을 붙잡아 두었다가, 돌려준 함수를 부르면 원래 핸들러(src/shared/mocks/files.ts)가 답하게 한다. 그동안 올리는 중인
 * 화면을 본다. jsdom은 응답이 올 때 본문을 한꺼번에 다 보냈다고 알리므로, 붙잡아 둔 동안의 진행률은 0이다.
 */
function holdUploads(): () => void {
  const { promise: released, resolve } = Promise.withResolvers<undefined>()
  server.use(
    http.post('*/files', async () => {
      await released
    }),
  )
  return () => {
    resolve(undefined)
  }
}

/** 업로드 operation(POST)의 요청을 모은다. 다른 출처로 보낼 때 브라우저가 먼저 보내는 preflight(OPTIONS)는 뺀다. */
function recordUploadRequests(): Request[] {
  const requests: Request[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST') requests.push(request)
  })
  onTestFinished(() => {
    server.events.removeAllListeners()
  })
  return requests
}

const textFile = (name: string, content = '업로드할 내용') => new File([content], name, { type: 'text/plain' })

/** 파일을 끌어 놓을 곳. 사용자는 안내 문구 위에 놓기도 하므로 문구에 놓는다(놓기 이벤트는 놓는 곳까지 올라간다). */
function dropZone(): HTMLElement {
  return screen.getByText(/파일을 여기에 끌어 놓거나/)
}

/** 업로드 목록에서 파일 하나의 항목 */
function uploadItem(name: string): HTMLElement {
  const item = screen.getAllByRole('listitem').find((element) => within(element).queryByText(name) !== null)
  if (item === undefined) throw new Error(`업로드 목록에 ${name}이 없습니다.`)
  return item
}

test('파일 선택으로 고른 파일을 올리는 동안 진행률을 보여 주고, 다 올리면 알린다', async () => {
  const user = userEvent.setup()
  const release = holdUploads()
  renderFileUploader()

  await user.upload(screen.getByLabelText('올릴 파일'), textFile('notes.txt'))

  const item = uploadItem('notes.txt')
  const progress = within(item).getByRole('progressbar', { name: 'notes.txt 업로드 진행률' })
  expect(progress).toHaveAttribute('aria-valuenow', '0')
  expect(progress).toHaveAttribute('aria-valuetext', '0%')
  expect(within(item).getByRole('status')).toHaveTextContent('올리는 중입니다.')

  release()

  expect(await within(item).findByText('올렸습니다.')).toBeInTheDocument()
  expect(within(item).queryByRole('progressbar')).not.toBeInTheDocument()
})

test('끌어 놓은 파일도 올린다', async () => {
  renderFileUploader()

  fireEvent.drop(dropZone(), {
    dataTransfer: { files: [textFile('dropped.txt')] },
  })

  expect(await within(uploadItem('dropped.txt')).findByText('올렸습니다.')).toBeInTheDocument()
})

test('명세가 받지 않는 크기·형식의 파일은 보내지 않고 이유를 알린다', async () => {
  const requests = recordUploadRequests()
  renderFileUploader()

  // 파일 고르기 창은 accept로 받는 형식만 보여 주지만, 끌어 놓은 파일은 걸러지지 않는다.
  fireEvent.drop(dropZone(), {
    dataTransfer: {
      files: [
        new File([new Uint8Array(UPLOAD_MAX_BYTES + 1)], 'huge.png', { type: 'image/png' }),
        new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' }),
      ],
    },
  })

  expect(within(uploadItem('huge.png')).getByRole('status')).toHaveTextContent(
    '올릴 수 없는 파일입니다. 5MB 이하의 파일만 올릴 수 있습니다.',
  )
  expect(within(uploadItem('setup.exe')).getByRole('status')).toHaveTextContent(
    '올릴 수 없는 파일입니다. PNG, JPEG, PDF, 텍스트 파일만 올릴 수 있습니다.',
  )
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(within(uploadItem('huge.png')).queryByRole('button', { name: /다시 시도/ })).not.toBeInTheDocument()
  // 보낸 요청이 있다면 응답을 기다리는 동안 목록에 남는다.
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(requests).toEqual([])
})

test('올리는 중에 취소하면 요청을 멈추고 알리며, 같은 자리의 다시 시도 버튼으로 처음부터 다시 올린다', async () => {
  const user = userEvent.setup()
  const requests = recordUploadRequests()
  const release = holdUploads()
  renderFileUploader()
  await user.upload(screen.getByLabelText('올릴 파일'), textFile('draft.txt'))
  const item = uploadItem('draft.txt')

  await user.click(within(item).getByRole('button', { name: 'draft.txt 업로드 취소' }))

  expect(await within(item).findByText('업로드를 취소했습니다.')).toBeInTheDocument()
  expect(within(item).queryByRole('progressbar')).not.toBeInTheDocument()
  // 누른 버튼이 다시 시도 버튼이 되어 포커스가 남는다.
  const retry = within(item).getByRole('button', { name: 'draft.txt 다시 시도' })
  expect(retry).toHaveFocus()

  await user.keyboard('{Enter}')

  expect(within(item).getByRole('status')).toHaveTextContent('올리는 중입니다.')
  expect(within(item).getByRole('button', { name: 'draft.txt 업로드 취소' })).toHaveFocus()
  release()
  expect(await within(item).findByText('올렸습니다.')).toBeInTheDocument()
  expect(requests).toHaveLength(2)
})

test('백엔드가 거절하면 알려 준 이유를 보여 주고, 다시 시도해 올린다', async () => {
  const user = userEvent.setup()
  renderFileUploader()

  // 이름에 flaky가 든 파일은 목 백엔드가 처음 한 번 503으로 거절한다(src/shared/mocks/files.ts).
  await user.upload(screen.getByLabelText('올릴 파일'), textFile('flaky-report.txt'))

  const item = uploadItem('flaky-report.txt')
  expect(
    await within(item).findByText('올리지 못했습니다. 일시적인 오류로 파일을 받지 못했습니다.'),
  ).toBeInTheDocument()

  await user.click(within(item).getByRole('button', { name: 'flaky-report.txt 다시 시도' }))

  expect(await within(item).findByText('올렸습니다.')).toBeInTheDocument()
})

test('여러 파일을 한꺼번에 고르면 파일마다 따로 올리고, 지운 항목의 버튼 대신 파일 선택 버튼에 포커스를 둔다', async () => {
  const user = userEvent.setup()
  renderFileUploader()

  await user.upload(screen.getByLabelText('올릴 파일'), [textFile('first.txt'), textFile('second.txt')])

  expect(await within(uploadItem('first.txt')).findByText('올렸습니다.')).toBeInTheDocument()
  expect(await within(uploadItem('second.txt')).findByText('올렸습니다.')).toBeInTheDocument()

  await user.click(within(uploadItem('first.txt')).getByRole('button', { name: 'first.txt 지우기' }))

  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByRole('button', { name: '파일 선택' })).toHaveFocus()
})

test('키보드로 파일 선택 버튼을 누르면 파일 고르기 창을 연다', async () => {
  const user = userEvent.setup()
  renderFileUploader()
  const input = screen.getByLabelText('올릴 파일')
  const openChooser = vi.fn((event: Event) => {
    // jsdom은 파일 고르기 창이 없으므로 열리는 것(파일 입력의 click)만 본다.
    event.preventDefault()
  })
  input.addEventListener('click', openChooser)

  await user.tab()
  expect(screen.getByRole('button', { name: '파일 선택' })).toHaveFocus()
  await user.keyboard('{Enter}')

  expect(openChooser).toHaveBeenCalledTimes(1)
})
