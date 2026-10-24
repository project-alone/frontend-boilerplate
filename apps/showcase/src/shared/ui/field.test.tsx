// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/field.test.tsx

import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { Field, FieldDescription, FieldError, FieldLabel } from './field'
import { Input } from './input'

test('설명과 오류 메시지를 입력 요소의 설명으로 읽고, 오류가 보이는 화면에도 접근성 위반이 없다', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <Field validationMode="onBlur">
      <FieldLabel>이메일</FieldLabel>
      <Input type="email" required />
      <FieldDescription>로그인할 때 씁니다.</FieldDescription>
      <FieldError match="valueMissing">이메일을 입력해 주세요.</FieldError>
    </Field>,
  )
  const input = screen.getByRole('textbox', { name: '이메일' })
  expect(input).toHaveAccessibleDescription('로그인할 때 씁니다.')

  // 입력한 값을 지우고 포커스를 옮기면 오류를 보여 주고, 스크린 리더가 읽도록 입력 요소의 설명에 넣는다.
  await user.type(input, 'a')
  await user.clear(input)
  await user.tab()
  await waitFor(() => {
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
  expect(input).toHaveAccessibleDescription(/이메일을 입력해 주세요\./)
  expect(await axeViolations(container)).toEqual([])
})
