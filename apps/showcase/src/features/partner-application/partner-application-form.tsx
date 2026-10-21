// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/features/partner-application/partner-application-form.tsx

'use client'

import { useId } from 'react'
import { Controller } from 'react-hook-form'
import { useSubmitPartnerApplicationMutation } from '@/queries/partners/partners.queries'
import { PartnerCategory, SubmitPartnerApplicationBody } from '@/shared/api/generated/model'
import { StepForm, type StepFormReturn } from '@/shared/multi-step-form/step-form'
import { StepIndicator } from '@/shared/multi-step-form/step-indicator'
import { useFormSteps } from '@/shared/multi-step-form/use-form-steps'
import { Checkbox } from '@/shared/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { useToast } from '@/shared/ui/toast'
import { CATEGORY_LABELS, PartnerApplicationReview } from './partner-application-review'

// multi-step-form Recipe: 입점 신청(submitPartnerApplication)의 요청 본문을 세 단계로 나눠 입력받고, 확인 단계에서 한 번에
// 보낸다. 단계마다 재생성 계층의 요청 본문 스키마(SubmitPartnerApplicationBody)에서 그 단계의 필드만 고른 스키마로
// 검증하므로(pick), 검증 규칙은 명세에서만 온다. 확인 단계는 요청 본문 스키마 전체로 한 번 더 검증한다.

const businessStep = SubmitPartnerApplicationBody.pick({ companyName: true, businessNumber: true, category: true })
const contactStep = SubmitPartnerApplicationBody.pick({ contactName: true, email: true, phone: true })
const planStep = SubmitPartnerApplicationBody.pick({
  productCount: true,
  monthlySales: true,
  introduction: true,
  agreedToTerms: true,
})

// 입력하는 단계(검증할 필드)와 확인 단계. 순서가 화면의 단계 순서다.
const INPUT_STEPS = [
  { title: '사업자 정보', schema: businessStep },
  { title: '담당자 정보', schema: contactStep },
  { title: '판매 계획', schema: planStep },
] as const
const STEP_TITLES = [...INPUT_STEPS.map(({ title }) => title), '신청 내용 확인']

const categoryOptions = PartnerCategory.options.map((category) => ({
  value: category,
  label: CATEGORY_LABELS[category],
}))

/**
 * 입점 신청 폼. 사업자 정보 → 담당자 정보 → 판매 계획 → 신청 내용 확인 순서로 입력받는다.
 *
 * - "다음"은 지금 단계의 필드만 검증하고, 통과하면 다음 단계로 간다. "이전"은 검증하지 않고 돌아가며 입력한 값은 남는다.
 * - 단계를 옮기면 포커스가 그 단계의 제목으로 가고, 검증에 실패하면 첫 오류 필드로 간다.
 * - 확인 단계의 "신청하기"가 모든 단계의 값을 partners Query Domain의 useSubmitPartnerApplicationMutation으로 한 번에
 *   보낸다. 성공하든 실패하든 알림(토스트)으로 알린다. 성공한 뒤의 동작(지금은 처음 단계로 돌아가 비운다)은 화면에 맞게 고친다.
 */
export function PartnerApplicationForm() {
  const steps = useFormSteps<SubmitPartnerApplicationBody>({
    count: STEP_TITLES.length,
    storageKey: 'partner-application-draft',
  })
  const headingId = useId()
  const mutation = useSubmitPartnerApplicationMutation()
  const toast = useToast()
  const title = STEP_TITLES[steps.index] ?? ''

  // 모든 단계가 같은 방식으로 값을 모은다. 다음은 검증을 통과한 뒤에, 이전은 검증하지 않고 지금 입력한 그대로 담는다.
  const stepProps = {
    defaultValues: steps.draft,
    onNext: (_: unknown, values: typeof steps.draft) => {
      steps.next(values)
    },
    onBack: steps.back,
    onValuesChange: steps.save,
    validateOnMount: steps.validateOnMount,
    labelledBy: headingId,
    submitLabel: '다음',
  }

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator label="입점 신청 단계" steps={STEP_TITLES} current={steps.index} />
      <h2 id={headingId} ref={steps.headingRef} tabIndex={-1} className="text-md font-semibold outline-none">
        {title}{' '}
        <span className="font-normal text-muted-foreground">
          ({STEP_TITLES.length}단계 중 {steps.index + 1}단계)
        </span>
      </h2>
      {steps.index === 0 && (
        <StepForm key={steps.formKey} schema={businessStep} {...stepProps} onBack={undefined}>
          {(form) => <BusinessFields form={form} />}
        </StepForm>
      )}
      {steps.index === 1 && (
        <StepForm key={steps.formKey} schema={contactStep} {...stepProps}>
          {(form) => <ContactFields form={form} />}
        </StepForm>
      )}
      {steps.index === 2 && (
        <StepForm key={steps.formKey} schema={planStep} {...stepProps}>
          {(form) => <PlanFields form={form} />}
        </StepForm>
      )}
      {steps.index === 3 && (
        <StepForm
          key={steps.formKey}
          schema={SubmitPartnerApplicationBody}
          {...stepProps}
          submitLabel="신청하기"
          pending={mutation.isPending}
          // 단계마다 검증했지만, 저장한 값을 이어 보여 줬다면 지금 규칙에 맞지 않을 수 있다. 그 값이 있는 첫 단계로 돌아간다.
          onInvalid={(errors) => {
            const step = INPUT_STEPS.findIndex(({ schema }) => Object.keys(errors).some((name) => name in schema.shape))
            steps.goTo(Math.max(step, 0), { validate: true })
          }}
          onNext={(application) => {
            mutation.mutate(application, {
              onSuccess: (receipt) => {
                toast.add({ title: '입점 신청 완료', description: `접수 번호 ${receipt.id}` })
                steps.reset()
              },
              onError: () => {
                toast.add({ type: 'error', title: '입점 신청 실패', description: '잠시 뒤에 다시 시도해 주세요.' })
              },
            })
          }}
        >
          {() => <PartnerApplicationReview draft={steps.draft} onEdit={steps.goTo} />}
        </StepForm>
      )}
    </div>
  )
}

function BusinessFields({ form }: Readonly<{ form: StepFormReturn<typeof businessStep> }>) {
  const {
    control,
    register,
    formState: { errors },
  } = form
  return (
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
  )
}

function ContactFields({ form }: Readonly<{ form: StepFormReturn<typeof contactStep> }>) {
  const {
    register,
    formState: { errors },
  } = form
  return (
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
  )
}

function PlanFields({ form }: Readonly<{ form: StepFormReturn<typeof planStep> }>) {
  const {
    control,
    register,
    formState: { errors },
  } = form
  return (
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
            {/* 명세의 const: true는 Zod의 "값은 true 이어야 합니다"로 알리므로, 화면에는 동의해야 한다는 문구를 보인다. */}
            <FieldError match={errors.agreedToTerms !== undefined}>입점 약관에 동의해야 신청할 수 있습니다.</FieldError>
          </Field>
        )}
      />
    </>
  )
}
