// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/realtime/src/shared/realtime/connection-status.test.tsx

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { ConnectionStatus } from './connection-status'

test.each([
  { status: 'connecting', label: '실시간 연결 중' },
  { status: 'open', label: '실시간 연결됨' },
  { status: 'reconnecting', label: '연결이 끊겨 다시 연결하는 중' },
] as const)('$status 상태를 색이 아니라 글자로 알리고 접근성 위반이 없다', async ({ status, label }) => {
  const { container } = render(<ConnectionStatus status={status} />)

  expect(screen.getByRole('status')).toHaveTextContent(label)
  expect(await axeViolations(container)).toEqual([])
})
