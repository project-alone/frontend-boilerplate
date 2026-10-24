// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/features/partner-application/partner-application-steps.tsx

'use client'

import type { ReactNode } from 'react'
import { Controller } from 'react-hook-form'
import { PartnerCategory, SubmitPartnerApplicationBody } from '@/shared/api/generated/model'
import type { FormDraft } from '@/shared/form/form-resolver'
import { displayValue, NOT_ENTERED } from '@/shared/multi-step-form/draft-summary'
import { StepForm, type StepFormProps } from '@/shared/multi-step-form/step-form'
import { Checkbox } from '@/shared/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'

// multi-step-form Recipe: 입점 신청서의 입력 단계. 단계마다 재생성 계층의 요청 본문 스키마(SubmitPartnerApplicationBody)에서
// 그 단계의 필드만 고른 스키마(pick)로 검증하므로 검증 규칙은 명세에서만 온다. 단계를 더하거나 순서를 바꾸려면
// PARTNER_APPLICATION_STEPS의 항목(제목, 스키마, 입력 요소, 확인 단계에 보일 값)만 고친다.

/** 모든 단계에서 입력한 값(검증하기 전) */
export type PartnerApplicationDraft = FormDraft<SubmitPartnerApplicationBody>

/** 모든 단계 폼이 함께 받는 props. PartnerApplicationForm이 useFormSteps로 채운다. */
export type CommonStepProps = Omit<
  StepFormProps<SubmitPartnerApplicationBody, unknown>,
  'schema' | 'children' | 'onInvalid'
>

export interface PartnerApplicationStep {
  title: string
  /** 이 단계에서 입력하는 필드. 확인 단계의 검증이 실패하면 오류 필드가 있는 단계로 돌아갈 때 쓴다. */
  fields: readonly string[]
  /** 이 단계의 폼 */
  render: (props: CommonStepProps) => ReactNode
  /** 확인 단계에 보일 [항목, 값] */
  summary: (draft: PartnerApplicationDraft) => [term: string, value: string][]
}

const businessStep = SubmitPartnerApplicationBody.pick({ companyName: true, businessNumber: true, category: true })
const contactStep = SubmitPartnerApplicationBody.pick({ contactName: true, email: true, phone: true })
const planStep = SubmitPartnerApplicationBody.pick({
  productCount: true,
  monthlySales: true,
  introduction: true,
  agreedToTerms: true,
})

// 판매 분야의 선택지. 레이블은 명세의 enum 값 대신 화면에 보일 이름이다.
const CATEGORY_LABELS: Record<PartnerCategory, string> = {
  fashion: '패션',
  food: '식품',
  living: '리빙',
  digital: '디지털',
}
const categoryOptions = PartnerCategory.options.map((category) => ({
  value: category,
  label: CATEGORY_LABELS[category],
}))

function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR')
}

// 단계마다의 입력 요소와 오류 표시는 `npm run g -- form`이 만드는 폼과 같다(Base README의 "폼"). 레이블은 명세의 title이다.
export const PARTNER_APPLICATION_STEPS: readonly PartnerApplicationStep[] = [
  {
    title: '사업자 정보',
    fields: Object.keys(businessStep.shape),
    render: (props) => (
      <StepForm schema={businessStep} {...props}>
        {({ control, register, formState: { errors } }) => (
          <>
            <Field invalid={errors.companyName !== undefined}>
              <FieldLabel>상호</FieldLabel>
              <Input {...register('companyName')} />
              <FieldError match={errors.companyName !== undefined}>{errors.companyName?.message}</FieldError>
            </Field>
            <Field invalid={errors.businessNumber !== undefined}>
              <FieldLabel>사업자등록번호</FieldLabel>
              <Input inputMode="numeric" {...register('businessNumber')} />
              <FieldDescription>000-00-00000 형식으로 적습니다.</FieldDescription>
              <FieldError match={errors.businessNumber !== undefined}>{errors.businessNumber?.message}</FieldError>
            </Field>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Field invalid={errors.category !== undefined}>
                  <Select
                    label="판매 분야"
                    options={categoryOptions}
                    value={field.value ?? null}
                    onValueChange={field.onChange}
                    inputRef={field.ref}
                  />
                  <FieldError match={errors.category !== undefined}>{errors.category?.message}</FieldError>
                </Field>
              )}
            />
          </>
        )}
      </StepForm>
    ),
    summary: (draft) => [
      ['상호', displayValue(draft.companyName)],
      ['사업자등록번호', displayValue(draft.businessNumber)],
      ['판매 분야', draft.category === undefined ? NOT_ENTERED : CATEGORY_LABELS[draft.category]],
    ],
  },
  {
    title: '담당자 정보',
    fields: Object.keys(contactStep.shape),
    render: (props) => (
      <StepForm schema={contactStep} {...props}>
        {({ register, formState: { errors } }) => (
          <>
            <Field invalid={errors.contactName !== undefined}>
              <FieldLabel>담당자 이름</FieldLabel>
              <Input autoComplete="name" {...register('contactName')} />
              <FieldError match={errors.contactName !== undefined}>{errors.contactName?.message}</FieldError>
            </Field>
            <Field invalid={errors.email !== undefined}>
              <FieldLabel>이메일</FieldLabel>
              <Input type="email" autoComplete="email" {...register('email')} />
              <FieldError match={errors.email !== undefined}>{errors.email?.message}</FieldError>
            </Field>
            <Field invalid={errors.phone !== undefined}>
              <FieldLabel>연락처</FieldLabel>
              <Input type="tel" autoComplete="tel" {...register('phone')} />
              <FieldDescription>010-0000-0000 형식으로 적습니다.</FieldDescription>
              <FieldError match={errors.phone !== undefined}>{errors.phone?.message}</FieldError>
            </Field>
          </>
        )}
      </StepForm>
    ),
    summary: (draft) => [
      ['담당자 이름', displayValue(draft.contactName)],
      ['이메일', displayValue(draft.email)],
      ['연락처', displayValue(draft.phone)],
    ],
  },
  {
    title: '판매 계획',
    fields: Object.keys(planStep.shape),
    render: (props) => (
      <StepForm schema={planStep} {...props}>
        {({ control, register, formState: { errors } }) => (
          <>
            <Field invalid={errors.productCount !== undefined}>
              <FieldLabel>판매할 상품 수</FieldLabel>
              <Input type="number" {...register('productCount', { valueAsNumber: true })} />
              <FieldError match={errors.productCount !== undefined}>{errors.productCount?.message}</FieldError>
            </Field>
            <Field invalid={errors.monthlySales !== undefined}>
              <FieldLabel>월 예상 매출(만 원)</FieldLabel>
              <Input type="number" {...register('monthlySales', { valueAsNumber: true })} />
              <FieldError match={errors.monthlySales !== undefined}>{errors.monthlySales?.message}</FieldError>
            </Field>
            <Field invalid={errors.introduction !== undefined}>
              <FieldLabel>회사 소개</FieldLabel>
              <Input {...register('introduction')} />
              <FieldError match={errors.introduction !== undefined}>{errors.introduction?.message}</FieldError>
            </Field>
            <Controller
              control={control}
              name="agreedToTerms"
              render={({ field }) => (
                <Field invalid={errors.agreedToTerms !== undefined}>
                  <FieldLabel>
                    <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} inputRef={field.ref} />
                    입점 약관에 동의합니다
                  </FieldLabel>
                  {/* 명세의 const: true라 체크하지 않으면 formResolver가 MUST_CHECK_MESSAGE("반드시 체크해야 합니다.")로 알린다. */}
                  <FieldError match={errors.agreedToTerms !== undefined}>{errors.agreedToTerms?.message}</FieldError>
                </Field>
              )}
            />
          </>
        )}
      </StepForm>
    ),
    summary: (draft) => [
      ['판매할 상품 수', displayValue(draft.productCount, (value) => `${formatNumber(value)}개`)],
      ['월 예상 매출', displayValue(draft.monthlySales, (value) => `${formatNumber(value)}만 원`)],
      ['회사 소개', displayValue(draft.introduction)],
      ['입점 약관', draft.agreedToTerms === true ? '동의함' : '동의하지 않음'],
    ],
  },
]
