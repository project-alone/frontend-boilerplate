import type { EventStreamStatus } from './event-stream'

// 상태마다 알리는 글자와 점의 모양. 점은 장식이다. 상태는 글자로 알리므로 색과 모양만으로 구별하지 않아도 된다.
const APPEARANCE: Record<EventStreamStatus, { label: string; dot: string }> = {
  connecting: { label: '실시간 연결 중', dot: 'border border-muted-foreground' },
  open: { label: '실시간 연결됨', dot: 'bg-primary' },
  reconnecting: { label: '연결이 끊겨 다시 연결하는 중', dot: 'bg-danger' },
}

/**
 * 실시간 연결 상태(useEventStream의 결과)를 글자와 점으로 보여 준다. 상태 문구(role="status")라서 상태가 바뀌면 스크린 리더가
 * 하던 말을 끊지 않고 알린다.
 */
export function ConnectionStatus({ status }: Readonly<{ status: EventStreamStatus }>) {
  const { label, dot } = APPEARANCE[status]
  return (
    <p role="status" className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
      {label}
    </p>
  )
}
