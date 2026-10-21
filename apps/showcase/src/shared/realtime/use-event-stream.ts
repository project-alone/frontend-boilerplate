// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/realtime/src/shared/realtime/use-event-stream.ts

import { useEffect, useEffectEvent, useState } from 'react'
import { connectEventStream, type EventStreamOptions, type EventStreamStatus } from './event-stream'

/**
 * 컴포넌트가 화면에 있는 동안 이벤트 스트림(path)에 연결하고 연결 상태를 돌려준다. 화면에서 빠지면 연결을 끊는다.
 * onEvent와 onOpen은 렌더링마다 새 함수여도 다시 연결하지 않고 가장 최근의 함수를 부른다.
 */
export function useEventStream(
  path: string,
  { onEvent, onOpen }: Pick<EventStreamOptions, 'onEvent' | 'onOpen'>,
): EventStreamStatus {
  const [status, setStatus] = useState<EventStreamStatus>('connecting')
  const handleEvent = useEffectEvent(onEvent)
  const handleOpen = useEffectEvent((connection: { reconnected: boolean }) => {
    onOpen?.(connection)
  })

  useEffect(
    () =>
      connectEventStream({
        path,
        onEvent: (event) => {
          handleEvent(event)
        },
        onOpen: (connection) => {
          handleOpen(connection)
        },
        onStatusChange: setStatus,
      }),
    [path],
  )

  return status
}
