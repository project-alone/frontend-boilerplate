// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/form/form-resolver.test.ts

import { expect, test } from 'vitest'
import * as z from 'zod'
import { formResolver, REQUIRED_MESSAGE } from './form-resolver'

// 재생성 계층(orval)의 요청 본문 스키마처럼 선택 필드는 exactOptional이다. 키가 없어야 하고 undefined 값은 받지 않는다.
const schema = z.object({
  name: z.string().min(2),
  age: z.int().exactOptional(),
  nickname: z.string().exactOptional(),
})

function validate(values: { name?: string; age?: number; nickname?: string }) {
  return formResolver(schema)(values, undefined, { fields: {}, shouldUseNativeValidation: false })
}

test('비워 둔 선택 필드(빈 문자열, 비운 숫자 입력의 NaN)는 빼고 검증을 통과한 값을 넘긴다', async () => {
  const result = await validate({ name: '홍길동', age: Number.NaN, nickname: '' })

  expect(result).toEqual({ values: { name: '홍길동' }, errors: {} })
})

test('비워 둔 필수 필드는 값을 입력하라고 알린다', async () => {
  const { errors } = await validate({ name: '' })

  expect(errors.name?.message).toBe(REQUIRED_MESSAGE)
})

test('그 밖의 검증 오류는 Zod의 한국어 메시지로 알린다', async () => {
  const { errors } = await validate({ name: '홍' })

  expect(errors.name?.message).toContain('2문자 이상')
})
