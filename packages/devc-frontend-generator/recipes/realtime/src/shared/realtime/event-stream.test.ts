import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { createMockEventStream, type MockEventStream } from '@/shared/mocks/event-stream'
import { server } from '@/shared/mocks/node'
import {
  connectEventStream,
  type EventStreamOptions,
  type EventStreamStatus,
  exponentialBackoff,
  type ServerSentEvent,
} from './event-stream'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로, 개발 서버와 E2E처럼 브라우저의 요청을 MSW가 받는
// 빌드를 흉내 낸다(server에서는 쓰이지 않는다). 요청은 Vitest의 MSW(@/shared/mocks/node)가 받는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

interface Connection {
  request: Request
  stream: MockEventStream
}

/** path로 오는 연결마다 테스트가 직접 이벤트를 보내는 목 이벤트 스트림을 연다. 연결한 순서대로 모은다. */
function serveEventStreams(path = '*/test/events'): Connection[] {
  const connections: Connection[] = []
  server.use(
    http.get(path, ({ request }) => {
      const stream = createMockEventStream()
      connections.push({ request, stream })
      return stream.response
    }),
  )
  return connections
}

/** n번째(1부터) 연결을 기다린다. */
async function connection(connections: Connection[], n: number): Promise<Connection> {
  return vi.waitFor(() => {
    const found = connections[n - 1]
    if (found === undefined) throw new Error(`${String(n)}번째 연결이 아직 없습니다.`)
    return found
  })
}

/** 테스트가 끝나면 끊는 이벤트 스트림 연결. 기본으로 다시 연결하기 전에 기다리지 않는다. */
function connect(options: Partial<EventStreamOptions> & Pick<EventStreamOptions, 'onEvent'>) {
  const close = connectEventStream({ path: '/test/events', retryDelay: () => 0, ...options })
  onTestFinished(close)
  return close
}

test('백엔드의 경로로 이벤트 스트림을 요청하고, 받은 이벤트를 이름·데이터·마지막 이벤트 id로 알린다', async () => {
  const connections = serveEventStreams()
  const events: ServerSentEvent[] = []
  connect({ onEvent: (event) => events.push(event) })
  const { request, stream } = await connection(connections, 1)

  stream.send({ event: 'greeting', data: 'hello', id: '1' })
  stream.send({ data: '{"count":2}' })

  await vi.waitFor(() => {
    expect(events).toEqual([
      { event: 'greeting', data: 'hello', lastEventId: '1' },
      { event: 'message', data: '{"count":2}', lastEventId: '1' },
    ])
  })
  // server는 BFF 프록시(/api/proxy/test/events), static-export는 백엔드 주소(/test/events)로 보낸다.
  expect(new URL(request.url).pathname).toMatch(/^(\/api\/proxy)?\/test\/events$/)
  expect(request.headers.get('accept')).toBe('text/event-stream')
})

test('여러 줄 데이터, CRLF·CR 줄 끝, 주석, 여러 조각으로 나뉘어 온 줄을 표준(HTML의 event stream 형식)대로 읽는다', async () => {
  const connections = serveEventStreams()
  const events: ServerSentEvent[] = []
  connect({ onEvent: (event) => events.push(event) })
  const { stream } = await connection(connections, 1)

  stream.write(': 주석은 무시한다\n')
  stream.write('event: multi\r\ndata: 첫 줄\r\ndata:둘째 줄\r\n\r\n')
  stream.write('id: 7\rdata: CR로\r\r')
  // 한 줄이 여러 조각으로 오고, CRLF의 CR과 LF가 다른 조각으로 온다.
  for (const chunk of ['da', 'ta: 나뉜 줄\r', '\ndata: 이어진 줄\r', '\n\r\n']) {
    stream.write(chunk)
    // 조각마다 따로 읽히도록 다음 조각을 보내기 전에 기다린다.
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  // 데이터가 없는 이벤트는 알리지 않고, 끝나지 않은 이벤트는 스트림이 끝날 때 버린다.
  stream.write('event: empty\n\ndata: 끝나지 않음')

  await vi.waitFor(() => {
    expect(events).toEqual([
      { event: 'multi', data: '첫 줄\n둘째 줄', lastEventId: '' },
      { event: 'message', data: 'CR로', lastEventId: '7' },
      { event: 'message', data: '나뉜 줄\n이어진 줄', lastEventId: '7' },
    ])
  })
})

test('백엔드가 스트림을 닫으면 다시 연결하고, 마지막으로 받은 이벤트 id를 Last-Event-ID로 보낸다', async () => {
  const connections = serveEventStreams()
  const statuses: EventStreamStatus[] = []
  const opens: boolean[] = []
  connect({
    onEvent: () => undefined,
    onStatusChange: (status) => statuses.push(status),
    onOpen: ({ reconnected }) => opens.push(reconnected),
  })
  const first = await connection(connections, 1)
  await vi.waitFor(() => {
    expect(statuses).toEqual(['connecting', 'open'])
  })
  expect(first.request.headers.get('last-event-id')).toBeNull()

  first.stream.send({ event: 'tick', data: '1', id: 'e-41' })
  first.stream.send({ event: 'tick', data: '2', id: 'e-42' })
  first.stream.close()

  const second = await connection(connections, 2)
  await vi.waitFor(() => {
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting', 'open'])
  })
  expect(second.request.headers.get('last-event-id')).toBe('e-42')
  expect(opens).toEqual([false, true])
})

test('연결하지 못하면(2xx가 아닌 응답, 이벤트 스트림이 아닌 응답, 네트워크 오류) 실패할 때마다 다음 대기 시간으로 다시 연결하고, 연결되면 처음 대기 시간부터 센다', async () => {
  const failures = [
    () => HttpResponse.json({ message: '점검 중' }, { status: 503 }),
    () => HttpResponse.json({ message: '이벤트 스트림이 아닌 응답' }),
    () => HttpResponse.error(),
  ]
  const streams: MockEventStream[] = []
  server.use(
    http.get('*/test/events', () => {
      const failure = failures.shift()
      if (failure !== undefined) return failure()
      const stream = createMockEventStream()
      streams.push(stream)
      return stream.response
    }),
  )
  const attempts: number[] = []
  const statuses: EventStreamStatus[] = []
  connect({
    onEvent: () => undefined,
    onStatusChange: (status) => statuses.push(status),
    retryDelay: (attempt) => {
      attempts.push(attempt)
      return 0
    },
  })

  await vi.waitFor(() => {
    expect(statuses.at(-1)).toBe('open')
  })
  expect(attempts).toEqual([1, 2, 3])
  expect(statuses).toEqual(['connecting', 'reconnecting', 'open'])

  streams[0]?.close()

  await vi.waitFor(() => {
    expect(streams).toHaveLength(2)
  })
  expect(attempts).toEqual([1, 2, 3, 1])
})

test('연결을 끊으면 더는 이벤트를 알리지 않고 다시 연결하지 않는다', async () => {
  const connections = serveEventStreams()
  const events: ServerSentEvent[] = []
  const statuses: EventStreamStatus[] = []
  const close = connect({
    onEvent: (event) => events.push(event),
    onStatusChange: (status) => statuses.push(status),
    retryDelay: () => 10,
  })
  const { stream } = await connection(connections, 1)
  await vi.waitFor(() => {
    expect(statuses).toEqual(['connecting', 'open'])
  })

  close()
  stream.send({ data: '끊은 뒤에 보낸 이벤트' })
  stream.close()

  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(events).toEqual([])
  expect(connections).toHaveLength(1)
  expect(statuses).toEqual(['connecting', 'open'])
})

test('기본 대기 시간은 0.5~1초에서 시작해 실패할 때마다 두 배가 되고 30초를 넘지 않는다. 그 범위 안에서는 무작위로 흩는다', () => {
  expect(exponentialBackoff(1, () => 0)).toBe(500)
  expect(exponentialBackoff(1, () => 1)).toBe(1000)
  expect(exponentialBackoff(2, () => 0)).toBe(1000)
  expect(exponentialBackoff(3, () => 0.5)).toBe(3000)
  expect(exponentialBackoff(6, () => 1)).toBe(30_000)
  expect(exponentialBackoff(20, () => 0)).toBe(15_000)
})
