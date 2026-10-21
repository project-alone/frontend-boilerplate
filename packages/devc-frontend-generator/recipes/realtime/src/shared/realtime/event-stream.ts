import { browserBaseUrl } from '@/shared/api/base-url'

// realtime Recipe: 백엔드가 Server-Sent Events(text/event-stream)로 보내는 이벤트를 받는 클라이언트(README의 "실시간 이벤트").
// 브라우저의 EventSource 대신 fetch로 읽는다. EventSource는 2xx가 아닌 응답을 받으면 다시 연결하지 않고, 다시 연결하는 간격을
// 정할 수 없고, 처음 연결과 다시 연결을 가려 알려 주지 않으며, Node.js(Vitest)에는 없다.
// 요청은 다른 API 요청과 같은 곳으로 간다(base-url.ts). server는 BFF 프록시(/api/proxy)를 거쳐 백엔드로, static-export는
// 백엔드로 직접 간다. BFF 프록시는 보통의 HTTP 응답처럼 스트림을 그대로 흘려보내므로 auth Recipe가 붙이는 토큰도 함께 간다.

/** 이벤트 스트림으로 받은 이벤트 하나 */
export interface ServerSentEvent {
  /** 이벤트 이름. 백엔드가 event 필드를 보내지 않았으면 'message'다. */
  event: string
  /** 데이터. 여러 줄이면 줄바꿈(\n)으로 이어 붙인다. */
  data: string
  /** 지금까지 받은 마지막 이벤트 id. 이 이벤트에 id가 없으면 앞 이벤트의 id다. */
  lastEventId: string
}

/** 연결 상태. 처음 연결하는 중, 연결됨, 끊겨서 다시 연결하는 중(기다리는 동안 포함) */
export type EventStreamStatus = 'connecting' | 'open' | 'reconnecting'

export interface EventStreamOptions {
  /** 이벤트 스트림의 경로(예: '/deliveries/events'). 브라우저의 다른 API 요청과 같은 곳(base-url.ts)으로 보낸다. */
  path: string
  /** 이벤트를 받을 때마다 */
  onEvent: (event: ServerSentEvent) => void
  /**
   * 연결될 때마다. 다시 연결했으면 reconnected가 true다. 끊긴 동안(처음 연결이면 연결되기 전)의 이벤트는 받지 못하므로,
   * 받은 이벤트로 고치는 데이터를 여기서 다시 맞춘다(예: 쿼리 무효화).
   */
  onOpen?: (connection: { reconnected: boolean }) => void
  /** 연결 상태가 바뀔 때마다 */
  onStatusChange?: (status: EventStreamStatus) => void
  /** 연달아 attempt번째(1부터) 실패한 뒤 다시 연결하기 전에 기다릴 시간(ms). 기본은 exponentialBackoff다. */
  retryDelay?: (attempt: number) => number
}

const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 30_000

/**
 * 다시 연결하기 전에 기다릴 시간(ms). 연달아 실패할 때마다 두 배로 늘리되(1초, 2초, 4초, … 최대 30초) 그 절반부터 전부까지에서
 * 무작위로 고른다. 백엔드가 다시 뜰 때 함께 끊긴 브라우저들이 한꺼번에 다시 연결하지 않도록 흩는 것이다.
 */
export function exponentialBackoff(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_RETRY_DELAY, INITIAL_RETRY_DELAY * 2 ** (attempt - 1))
  return ceiling / 2 + (ceiling / 2) * random()
}

/**
 * 이벤트 스트림에 연결한다. 백엔드가 스트림을 닫거나 연결하지 못하면 retryDelay만큼 기다렸다가 다시 연결하고, 마지막으로 받은
 * 이벤트 id를 Last-Event-ID 헤더로 보낸다(백엔드가 이어서 보낼 수 있으면 쓴다). 돌려준 함수를 부르면 연결을 끊고 다시 연결하지 않는다.
 */
export function connectEventStream({
  path,
  onEvent,
  onOpen,
  onStatusChange,
  retryDelay = exponentialBackoff,
}: EventStreamOptions): () => void {
  const controller = new AbortController()
  const { signal } = controller
  // 기다리는 동안 바뀌므로 signal.aborted를 그때마다 읽는다.
  const closed = () => signal.aborted
  let status: EventStreamStatus | undefined
  const setStatus = (next: EventStreamStatus) => {
    if (next === status) return
    status = next
    onStatusChange?.(next)
  }

  void (async () => {
    let lastEventId = ''
    let opened = false
    // 연달아 실패한 횟수. 연결되면 0으로 돌아간다.
    let failures = 0
    setStatus('connecting')
    for (;;) {
      try {
        const response = await fetch(`${browserBaseUrl()}${path}`, {
          headers: { accept: 'text/event-stream', ...(lastEventId === '' ? {} : { 'last-event-id': lastEventId }) },
          cache: 'no-store',
          signal,
        })
        const isEventStream = response.headers.get('content-type')?.startsWith('text/event-stream') ?? false
        if (response.ok && isEventStream && response.body !== null) {
          failures = 0
          setStatus('open')
          onOpen?.({ reconnected: opened })
          opened = true
          await readEvents(response.body, (event) => {
            lastEventId = event.lastEventId
            dispatch(onEvent, event)
          })
        } else {
          await response.body?.cancel()
        }
      } catch {
        // 네트워크 오류이거나 연결을 끊었다(signal).
      }
      if (closed()) return
      failures += 1
      setStatus('reconnecting')
      await sleep(retryDelay(failures), signal)
      if (closed()) return
    }
  })()

  return () => {
    controller.abort()
  }
}

/** 이벤트를 알린다. 받는 쪽의 오류는 연결이 끊긴 것으로 보지 않고 따로 던져 드러낸다. */
function dispatch(onEvent: (event: ServerSentEvent) => void, event: ServerSentEvent) {
  try {
    onEvent(event)
  } catch (error) {
    queueMicrotask(() => {
      throw error
    })
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/**
 * 응답 본문을 text/event-stream 형식(HTML 표준의 "event stream interpretation")으로 읽어, 이벤트가 끝날 때마다(빈 줄)
 * onEvent를 부른다. 스트림이 끝나면 돌아오고, 끝나지 않은 이벤트는 버린다. retry 필드는 쓰지 않는다(retryDelay를 쓴다).
 */
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: ServerSentEvent) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = ''
  let data: string[] = []
  let lastEventId = ''

  const processLine = (line: string) => {
    if (line === '') {
      if (data.length > 0)
        onEvent({ event: eventName === '' ? 'message' : eventName, data: data.join('\n'), lastEventId })
      eventName = ''
      data = []
      return
    }
    // 콜론으로 시작하는 줄은 주석이다(연결을 유지하려고 보내는 줄 등).
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(line.startsWith(' ', colon + 1) ? colon + 2 : colon + 1)
    if (field === 'event') eventName = value
    else if (field === 'data') data.push(value)
    else if (field === 'id' && !value.includes('\0')) lastEventId = value
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    // 줄 끝은 CRLF, LF, CR 가운데 하나다.
    for (;;) {
      const end = buffer.search(/[\r\n]/)
      // 조각이 CR로 끝나면 다음 조각이 LF로 시작할 수 있으므로(CRLF) 다음 조각을 기다린다.
      if (end === -1 || (buffer[end] === '\r' && end === buffer.length - 1)) break
      processLine(buffer.slice(0, end))
      buffer = buffer.slice(buffer.startsWith('\r\n', end) ? end + 2 : end + 1)
    }
  }
}
