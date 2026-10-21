// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/features/partner-application/partner-application-form.tsx

'use client'

import { Fragment, useId } from 'react'
import { useSubmitPartnerApplicationMutation } from '@/queries/partners/partners.queries'
import { SubmitPartnerApplicationBody } from '@/shared/api/generated/model'
import { StepForm } from '@/shared/multi-step-form/step-form'
import { StepIndicator } from '@/shared/multi-step-form/step-indicator'
import { useFormSteps } from '@/shared/multi-step-form/use-form-steps'
import { useToast } from '@/shared/ui/toast'
import { PartnerApplicationReview } from './partner-application-review'
import { type CommonStepProps, PARTNER_APPLICATION_STEPS } from './partner-application-steps'

const STEP_TITLES = [...PARTNER_APPLICATION_STEPS.map(({ title }) => title), '신청 내용 확인']

/**
 * 입점 신청(submitPartnerApplication) 폼(multi-step-form Recipe). 사업자 정보 → 담당자 정보 → 판매 계획 → 신청 내용 확인
 * 순서로 입력받는다(단계는 partner-application-steps.tsx).
 *
 * - "다음"은 지금 단계의 필드만 검증하고, 통과하면 다음 단계로 간다. "이전"은 검증하지 않고 돌아가며 입력한 값은 남는다.
 * - 단계를 옮기면 포커스가 그 단계의 제목으로 가고, 검증에 실패하면 첫 오류 필드로 간다.
 * - 확인 단계의 "신청하기"가 모든 단계의 값을 요청 본문 스키마 전체로 한 번 더 검증한 뒤, partners Query Domain의
 *   useSubmitPartnerApplicationMutation으로 한 번에 보낸다. 성공하든 실패하든 알림(토스트)으로 알린다.
 *   성공한 뒤의 동작(지금은 처음 단계로 돌아가 비운다)은 화면에 맞게 고친다(완료 페이지로 이동 등).
 */
export function PartnerApplicationForm() {
  const steps = useFormSteps<SubmitPartnerApplicationBody>({
    count: STEP_TITLES.length,
    storageKey: 'partner-application-draft',
  })
  const headingId = useId()
  const mutation = useSubmitPartnerApplicationMutation()
  const toast = useToast()
  const inputStep = PARTNER_APPLICATION_STEPS[steps.index]
  // 스크린 리더는 단계를 옮길 때 포커스를 받은 제목과 함께 이 문구를 읽는다.
  const position = `(${String(STEP_TITLES.length)}단계 중 ${String(steps.index + 1)}단계)`

  // 모든 단계가 같은 방식으로 값을 모은다. 다음은 검증을 통과한 뒤에, 이전은 검증하지 않고 지금 입력한 그대로 담는다.
  const stepProps: CommonStepProps = {
    defaultValues: steps.draft,
    onNext: (_, values) => {
      steps.next(values)
    },
    onBack: steps.index > 0 ? steps.back : undefined,
    onValuesChange: steps.save,
    validateOnMount: steps.validateOnMount,
    labelledBy: headingId,
    submitLabel: '다음',
    pending: mutation.isPending,
  }

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator label="입점 신청 단계" steps={STEP_TITLES} current={steps.index} />
      <h2 id={headingId} ref={steps.headingRef} tabIndex={-1} className="text-md outline-none">
        <span className="font-semibold">{STEP_TITLES[steps.index]}</span>{' '}
        <span className="text-muted-foreground">{position}</span>
      </h2>
      {/* 단계를 옮기면 key가 바뀌어 그 단계의 폼을 모든 단계의 값(draft)으로 새로 만든다. */}
      <Fragment key={steps.formKey}>
        {inputStep !== undefined ? (
          inputStep.render(stepProps)
        ) : (
          <StepForm
            schema={SubmitPartnerApplicationBody}
            {...stepProps}
            submitLabel="신청하기"
            // 단계마다 검증했지만, 저장한 값을 이어 보여 줬다면 지금 규칙에 맞지 않을 수 있다. 그 값이 있는 첫 단계로 돌아간다.
            onInvalid={(errors) => {
              const invalid = Object.keys(errors)
              const step = PARTNER_APPLICATION_STEPS.findIndex(({ fields }) =>
                fields.some((name) => invalid.includes(name)),
              )
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
            {() => (
              <PartnerApplicationReview
                sections={PARTNER_APPLICATION_STEPS.map(({ title, summary }) => ({
                  title,
                  items: summary(steps.draft),
                }))}
                onEdit={steps.goTo}
                disabled={mutation.isPending}
              />
            )}
          </StepForm>
        )}
      </Fragment>
    </div>
  )
}
