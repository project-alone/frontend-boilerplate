// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/form/form-resolver.ts

import { zodResolver } from '@hookform/resolvers/zod'
import type { FieldValues, Resolver } from 'react-hook-form'
import * as z from 'zod'

/** 값을 넣지 않은 필수 필드에 보이는 오류 메시지 */
export const REQUIRED_MESSAGE = '값을 입력해 주세요.'

/** 반드시 true여야 하는 필드(명세의 const: true, enum: [true]. 예: 약관 동의)를 체크하지 않았을 때 보이는 오류 메시지 */
export const MUST_CHECK_MESSAGE = '반드시 체크해야 합니다.'

/**
 * 입력하는 동안 폼이 들고 있는 값. 검증하기 전에는 어떤 필드든 비어 있을 수 있고, 반드시 true여야 하는 필드의 체크박스도
 * 체크하지 않은 값(false)을 담는다.
 */
export type FormDraft<Values extends FieldValues> = { [Key in keyof Values]?: DraftValue<Values[Key]> | undefined }

type DraftValue<Value> = Value extends true ? boolean : Value

const koreanError = z.locales.ko().localeError

// 반드시 true여야 하는 필드는 MUST_CHECK_MESSAGE로, 값을 넣지 않은 필드는 REQUIRED_MESSAGE로, 나머지 오류는 Zod의 한국어 메시지로 알린다.
const formError: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === 'invalid_value' && issue.values.length === 1 && issue.values[0] === true) return MUST_CHECK_MESSAGE
  return issue.input === undefined ? REQUIRED_MESSAGE : koreanError(issue)
}

export interface FormResolverOptions<Input extends FieldValues> {
  /**
   * 폼이 처음 보여 준 값. useForm의 defaultValues와 같은 값을 넘긴다. null을 받는 선택 필드는 여기에 값이 있던 입력을
   * 비웠을 때만 null을 보낸다(값을 지운다). 처음부터 비어 있던 입력은 보내지 않는다.
   */
  defaultValues?: FormDraft<Input> | undefined
}

/**
 * React Hook Form이 Zod 스키마로 폼 값을 검증하게 한다(useForm의 resolver). 스키마는 재생성 계층의 요청 본문 스키마
 * (src/shared/api/generated/model의 <OperationId>Body)를 그대로 쓰고(ADR-0003), 제출 핸들러는 검증을 통과한 값을 받는다.
 *
 * 비워 둔 입력(빈 문자열, 고르지 않은 Select, 비운 숫자 입력의 NaN, null, undefined)은 스키마에 따라 검증 전에 바꾼다.
 * 반드시 true여야 하는 필드의 체크하지 않은 체크박스(false)도 비워 둔 입력으로 본다.
 * - null을 받는 필수 필드는 null을 보낸다.
 * - null을 받는 선택 필드는 처음 값(options.defaultValues)이 있던 입력을 비웠으면 null을 보내고, 아니면 보내지 않는다.
 * - 그 밖의 선택 필드는 보내지 않는다. 그 밖의 필수 필드는 REQUIRED_MESSAGE로, 반드시 true여야 하는 필드는
 *   MUST_CHECK_MESSAGE로 알린다.
 * - 기본값(default)이 있는 필드는 선택 필드처럼 다룬다. 보내지 않으면 스키마가 기본값을 넣는다.
 *
 * 필드마다의 규칙은 객체 스키마(z.object. 단계별 폼이 쓰는 .pick() 결과 포함)의 필드를 보고 정한다. 객체 스키마가 아니면
 * (.refine, .pipe 등으로 감싼 스키마) 필드를 볼 수 없으므로 비워 둔 입력을 모두 보내지 않는다.
 */
export function formResolver<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>,
  { defaultValues }: FormResolverOptions<Input> = {},
): Resolver<FormDraft<Input>, unknown, Output> {
  // 검증 전의 값(FormDraft)은 스키마의 입력 타입과 다르다. 값이 맞는지는 Zod가 실행할 때 검사하므로 타입만 맞춘다.
  const resolve = zodResolver(schema as unknown as z.ZodType<Output, FormDraft<Input>>, { error: formError })
  const fields: Record<string, z.ZodType> = schema instanceof z.ZodObject ? schema.shape : {}
  const hadValue = (name: string) => !isEmpty((defaultValues as Record<string, unknown> | undefined)?.[name])
  return (values, context, options) => {
    const entries = Object.entries(values).flatMap(([name, value]): [string, unknown][] => {
      const field = fields[name]
      if (!isEmpty(value, field)) return [[name, value]]
      if (!field?.safeParse(null).success) return []
      // optin은 Zod가 객체의 키를 빼도 되는지 적어 두는 값이다. 없으면 키가 꼭 있어야 하는 필수 필드이고, 선택 필드('optional')와
      // 기본값이 있는 필드('defaulted')는 키를 빼도 된다. Zod를 올리면 form-resolver.test.ts가 이 규칙을 확인한다.
      return field._zod.optin === undefined || hadValue(name) ? [[name, null]] : []
    })
    return resolve(Object.fromEntries(entries) as FormDraft<Input>, context, options)
  }
}

// 비워 둔 입력인가. false는 체크하지 않은 체크박스이므로 그 필드가 false를 받지 않을 때(반드시 true여야 할 때)만 비워 둔 것으로 본다.
function isEmpty(value: unknown, field?: z.ZodType): boolean {
  if (value === false) return field !== undefined && !field.safeParse(false).success
  return value === '' || value === null || value === undefined || Number.isNaN(value)
}
