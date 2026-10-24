import { HttpResponse } from 'msw'

// realtime Recipe: MSW 핸들러가 돌려줄 이벤트 스트림(text/event-stream) 응답. 핸들러가 응답을 돌려준 뒤에도 send로
// 이벤트를 보내고, close로 백엔드가 연결을 끊은 것처럼 스트림을 닫는다. 목 백엔드(deliveries.ts)와 테스트가 함께 쓴다.
//
// MSW의 sse()는 핸들러를 만들 때 전역 EventSource가 있어야 해서, EventSource가 없는 Node.js(Vitest, Next.js 서버의 MSW)에서는
// 쓸 수 없다. 그래서 응답 본문을 흘려보내는 보통의 HTTP 핸들러로 흉내 낸다. 브라우저의 MSW(서비스 워커)도 같은 응답을 흘려보낸다.

/** 이벤트 스트림으로 보낼 이벤트 하나. event가 없으면 브라우저는 message 이벤트로 받는다. */
export interface MockServerSentEvent {
  event?: string
  data: string
  id?: string
}

export interface MockEventStream {
  /** 핸들러가 돌려줄 응답 */
  readonly response: Response
  /** 이벤트 하나를 보낸다. */
  send: (event: MockServerSentEvent) => void
  /** text/event-stream 형식의 글을 그대로 보낸다. 줄 끝과 조각을 마음대로 나눠 보낼 때 쓴다. */
  write: (text: string) => void
  /** 백엔드가 연결을 끊은 것처럼 스트림을 닫는다. */
  close: () => void
}

const encoder = new TextEncoder()

/**
 * 이벤트 스트림 응답을 연다. Node.js의 MSW는 받는 쪽이 연결을 끊어도 핸들러에 알리지 않으므로(요청의 signal도, 응답 본문의
 * cancel도 오지 않는다), 다 쓴 스트림은 close로 닫는다.
 */
export function createMockEventStream(): MockEventStream {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let closed = false
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController
      // 실제 백엔드에 바라는 것처럼 연결하자마자 주석 한 줄을 보내 응답을 시작한다. 프록시(BFF 프록시 등)와 fetch는 본문의
      // 첫 바이트가 올 때 응답을 넘기므로, 이 줄이 없으면 첫 이벤트가 올 때까지 연결되었는지 알 수 없다.
      streamController.enqueue(encoder.encode(':connected\n\n'))
    },
    cancel() {
      closed = true
    },
  })
  const write = (text: string) => {
    if (!closed) controller?.enqueue(encoder.encode(text))
  }
  return {
    response: new HttpResponse(body, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        // Next.js 서버의 MSW(msw/node)는 길이를 모르는 응답을 연결을 닫아 끝내는 방식으로 보낸다. 그러면 받는 쪽(BFF 프록시의
        // fetch)이 먼저 끊을 때 Node.js의 fetch(undici)가 닫힌 연결을 응답의 끝으로 읽다가 서버에 uncaughtException을 남긴다.
        // chunked로 보내 응답의 끝을 따로 표시한다. 브라우저의 MSW(서비스 워커)에는 이 헤더가 필요 없다.
        ...(typeof window === 'undefined' ? { 'transfer-encoding': 'chunked' } : {}),
      },
    }),
    // 이벤트를 text/event-stream 형식으로 쓴다. 여러 줄의 데이터는 줄마다 data 필드가 된다.
    send: ({ event, data, id }) => {
      const fields = [
        ...(id === undefined ? [] : [`id: ${id}`]),
        ...(event === undefined ? [] : [`event: ${event}`]),
        ...data.split(/\r\n|\r|\n/).map((line) => `data: ${line}`),
      ]
      write(`${fields.join('\n')}\n\n`)
    },
    write,
    close: () => {
      if (closed) return
      closed = true
      controller?.close()
    },
  }
}
