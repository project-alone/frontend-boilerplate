// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/form/form-resolver.ts

import { zodResolver } from '@hookform/resolvers/zod'
import type { FieldValues, Resolver } from 'react-hook-form'
import * as z from 'zod'

/** 값을 넣지 않은 필수 필드에 보이는 오류 메시지 */
export const REQUIRED_MESSAGE = '값을 입력해 주세요.'

/** 입력하는 동안 폼이 들고 있는 값. 검증하기 전에는 어떤 필드든 비어 있을 수 있다. */
export type FormDraft<Values extends FieldValues> = { [Key in keyof Values]?: Values[Key] | undefined }

const koreanError = z.locales.ko().localeError

// 값을 넣지 않은 필드는 REQUIRED_MESSAGE로, 나머지 오류는 Zod의 한국어 메시지로 알린다.
const formError: z.core.$ZodErrorMap = (issue) => (issue.input === undefined ? REQUIRED_MESSAGE : koreanError(issue))

/**
 * React Hook Form이 Zod 스키마로 폼 값을 검증하게 한다(useForm의 resolver). 스키마는 재생성 계층의 요청 본문 스키마
 * (src/shared/api/generated/model의 <OperationId>Body)를 그대로 쓰고(ADR-0003), 제출 핸들러는 검증을 통과한 값을 받는다.
 *
 * 비워 둔 입력(빈 문자열, 고르지 않은 Select, 비운 숫자 입력의 NaN, undefined)은 값을 넣지 않은 것으로 보고 검증 전에 뺀다.
 * 그래서 비워 둔 선택 필드는 요청에 담기지 않고, 비워 둔 필수 필드는 REQUIRED_MESSAGE로 알린다.
 */
export function formResolver<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>,
): Resolver<FormDraft<Input>, unknown, Output> {
  // 검증 전의 값(FormDraft)은 스키마의 입력 타입과 다르다. 값이 맞는지는 Zod가 실행할 때 검사하므로 타입만 맞춘다.
  const resolve = zodResolver(schema as unknown as z.ZodType<Output, FormDraft<Input>>, { error: formError })
  return (values, context, options) => resolve(withoutEmptyValues(values), context, options)
}

function withoutEmptyValues<Values extends FieldValues>(values: Values): Values {
  const entries = Object.entries(values).filter(
    ([, value]) => value !== '' && value !== undefined && !Number.isNaN(value),
  )
  return Object.fromEntries(entries) as Values
}
