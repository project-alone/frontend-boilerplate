// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/page.test.tsx

import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import HomePage from './page'

test('홈 페이지는 제목을 보여 준다', () => {
  render(<HomePage />)

  expect(screen.getByRole('heading', { level: 1, name: 'Starter' })).toBeInTheDocument()
})
