// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/shared/multi-step-form/use-form-steps.ts

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import type { FieldValues } from 'react-hook-form'
import type { FormDraft } from '@/shared/form/form-resolver'
import { readDraft, removeDraft, writeDraft } from './draft-storage'

export interface FormStepsOptions {
  /** 단계 수(확인 단계 포함) */
  count: number
  /** 입력하던 값을 둘 sessionStorage의 키. 폼마다 다르게 짓는다. */
  storageKey: string
}

export interface FormSteps<Values extends FieldValues> {
  /** 지금 단계. 0부터 센다. */
  index: number
  /** 모든 단계에서 입력한 값. 검증하기 전의 값이다. */
  draft: FormDraft<Values>
  /** 단계 폼의 key. 단계를 옮기거나 저장한 값을 읽을 때마다 바뀌어 그 단계의 폼을 draft로 새로 만든다. */
  formKey: string
  /** 단계 폼이 처음부터 검증해 오류를 보여야 하는지(goTo의 validate). StepForm의 validateOnMount에 넘긴다. */
  validateOnMount: boolean
  /** 단계의 제목에 붙인다. 단계를 옮기면 이 제목으로 포커스를 옮겨 스크린 리더가 지금 단계를 읽게 한다. */
  headingRef: RefObject<HTMLHeadingElement | null>
  /** 지금 단계에서 입력한 값을 draft에 담고 다음 단계로 간다. 지금 단계의 검증을 통과한 뒤에 부른다. */
  next: (values: FormDraft<Values>) => void
  /** 지금 단계에서 입력한 값을 검증하지 않고 draft에 담은 채 이전 단계로 간다. */
  back: (values: FormDraft<Values>) => void
  /**
   * index 단계로 간다(확인 단계의 "수정"). validate면 그 단계의 폼이 처음부터 검증해 오류를 알리고, 포커스는 제목 대신
   * 첫 오류 필드로 간다(제출할 때 draft가 검증에 실패했을 때).
   */
  goTo: (index: number, options?: { validate?: boolean }) => void
  /** 지금 단계에서 입력하는 값을 저장만 한다(StepForm의 onValuesChange). 새로 고쳐도 입력하던 값이 남는다. */
  save: (values: FormDraft<Values>) => void
  /** 처음 단계로 돌아가고 입력한 값과 저장한 값을 모두 지운다(제출에 성공했을 때). */
  reset: () => void
}

interface StepsState<Values extends FieldValues> {
  index: number
  draft: FormDraft<Values>
  // 단계 폼을 새로 만들 때마다 하나씩 늘린다(formKey).
  revision: number
  validate: boolean
}

/**
 * 다단계 폼의 단계와 단계마다 입력한 값을 들고 있다. 단계마다 그 단계의 필드만 담은 폼(StepForm)을 만들고, 그 폼이
 * 검증을 통과하면 next로, 검증 없이 돌아가면 back으로 입력한 값을 draft에 모은다. 마지막(확인) 단계에서 draft 전체를
 * 요청 본문의 스키마로 한 번 더 검증해 보낸다.
 *
 * 단계와 draft는 sessionStorage(storageKey)에도 저장해, 페이지를 새로 고치면 처음 그린 뒤에 이어서 보여 준다. 서버가 보낸
 * HTML(첫 단계, 빈 값)과 첫 렌더링이 같아야 hydration이 어긋나지 않으므로 저장한 값은 그린 뒤에 읽는다.
 */
export function useFormSteps<Values extends FieldValues>({ count, storageKey }: FormStepsOptions): FormSteps<Values> {
  const [state, setState] = useState<StepsState<Values>>(INITIAL_STATE)
  // 이벤트 처리기가 setState를 기다리지 않고 지금 값으로 다음 값을 정하고 저장하도록 같은 값을 들고 있다.
  const current = useRef(state)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // 사용자가 단계를 옮겼을 때만 제목으로 포커스를 옮긴다. 처음 그릴 때와 저장한 값을 이어 보여 줄 때는 옮기지 않는다.
  const focusHeading = useRef(false)

  const update = useCallback((next: Omit<StepsState<Values>, 'revision'>, { focus }: { focus: boolean }) => {
    const nextState = { ...next, revision: current.current.revision + 1 }
    current.current = nextState
    focusHeading.current = focus
    setState(nextState)
  }, [])

  useEffect(() => {
    const stored = readDraft(storageKey)
    if (stored === undefined) return
    // 저장한 값의 타입은 폼이 검증한다(StepForm, 확인 단계).
    update(
      { index: Math.min(stored.step, count - 1), draft: stored.values as FormDraft<Values>, validate: false },
      { focus: false },
    )
  }, [count, storageKey, update])

  useEffect(() => {
    if (!focusHeading.current) return
    focusHeading.current = false
    headingRef.current?.focus()
  }, [state.revision])

  const move = useCallback(
    (target: number, values: FormDraft<Values>, validate = false) => {
      const index = Math.min(Math.max(target, 0), count - 1)
      const draft = { ...current.current.draft, ...values }
      update({ index, draft, validate }, { focus: !validate })
      writeDraft(storageKey, index, draft)
    },
    [count, storageKey, update],
  )

  return {
    index: state.index,
    draft: state.draft,
    formKey: String(state.revision),
    validateOnMount: state.validate,
    headingRef,
    next: useCallback(
      (values) => {
        move(current.current.index + 1, values)
      },
      [move],
    ),
    back: useCallback(
      (values) => {
        move(current.current.index - 1, values)
      },
      [move],
    ),
    goTo: useCallback(
      (index, { validate = false } = {}) => {
        move(index, {}, validate)
      },
      [move],
    ),
    save: useCallback(
      (values) => {
        writeDraft(storageKey, current.current.index, { ...current.current.draft, ...values })
      },
      [storageKey],
    ),
    reset: useCallback(() => {
      update(INITIAL_STATE, { focus: true })
      removeDraft(storageKey)
    }, [storageKey, update]),
  }
}

const INITIAL_STATE = { index: 0, draft: {}, revision: 0, validate: false }
