// 컨텍스트는 클라이언트 컴포넌트에서만 쓸 수 있으므로, 서버 컴포넌트에서도 쓰는 field.tsx와 나눠 클라이언트 컴포넌트로 둔다.
'use client'

import { createContext, type ReactNode, use } from 'react'

const FieldLabelIdContext = createContext<string | undefined>(undefined)

/** FieldLabel이 감싼 컨트롤에 레이블의 id를 알린다. */
export function FieldLabelIdProvider({ id, children }: { id: string; children: ReactNode }) {
  return <FieldLabelIdContext value={id}>{children}</FieldLabelIdContext>
}

/** 이 컨트롤을 감싼 FieldLabel의 id. FieldLabel 밖이면 undefined다. */
export function useFieldLabelId(): string | undefined {
  return use(FieldLabelIdContext)
}
