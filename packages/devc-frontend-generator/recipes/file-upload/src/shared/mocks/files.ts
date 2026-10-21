import { delay, http, HttpResponse, type JsonBodyType } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import type { UploadedFile, UploadError } from '@/shared/api/generated/model'
import { findUploadProblem, type UploadProblem } from '@/shared/upload/upload-policy'

// file-upload Recipe: 업로드 operation(uploadFile, POST /files)을 흉내 내는 MSW 핸들러. 명세에서 생성한 핸들러는 example을
// 그대로 돌려주므로, 이 핸들러가 그보다 앞에서(확장 지점 mockHandlers, extensions.json) 올린 파일을 읽어 백엔드처럼 답한다. Vitest, 개발 서버, E2E가 모두
// 이 핸들러를 쓴다. 실패와 취소를 직접 해 볼 수 있도록 파일 이름으로 응답을 고른다.
//
// - 이름에 slow가 들어 있으면 SLOW_RESPONSE_MS 뒤에 답한다. 그동안 취소해 볼 수 있다.
// - 이름에 flaky가 들어 있으면 그 이름으로 처음 올릴 때 503으로 실패하고, 같은 이름으로 다시 올리면 받는다.
// - 명세가 받지 않는 파일(5MB보다 큼, 받지 않는 형식)은 413, 415로 거절한다. 업로더는 올리기 전에 같은 기준으로 거르므로,
//   이 응답은 검사를 거치지 않고 보낸 요청에만 간다.

/** 이름에 slow가 든 파일에 답하기까지 기다리는 시간(ms) */
export const SLOW_RESPONSE_MS = 3000

// static-export에서는 브라우저가 다른 출처의 백엔드를 직접 부른다. 업로더는 진행률을 받으려고 upload 이벤트를 들으므로 브라우저가
// preflight(OPTIONS)를 먼저 보내고(src/shared/upload/api-upload.ts), 응답에는 CORS 헤더가 있어야 브라우저가 읽는다. 실제 백엔드도 같다(README의 "파일 업로드").
// 브라우저의 MSW(서비스 워커)는 preflight 없이 받지만, Vitest의 jsdom은 브라우저처럼 CORS를 검사한다.
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

/** 처음 올릴 때 한 번 실패시킨 flaky 파일의 이름 */
const failedOnce = new Set<string>()
let uploadedCount = 0

function respond(body: JsonBodyType, status: number) {
  return HttpResponse.json(body, { status, headers: CORS_HEADERS })
}

/** 명세의 오류 응답(UploadError)으로 업로드를 거절한다. */
function refuse(status: number, message: string) {
  return respond({ message } satisfies UploadError, status)
}

/** 명세가 받지 않는 파일의 이유마다 거절하는 상태 코드 */
const PROBLEM_STATUS = { 'too-large': 413, 'unsupported-type': 415 } as const satisfies Record<
  UploadProblem['reason'],
  number
>

export const filesHandlers = [
  http.options(
    `${MOCK_API_BASE_URL}/files`,
    () =>
      new HttpResponse(null, {
        status: 204,
        headers: { ...CORS_HEADERS, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Max-Age': '600' },
      }),
  ),
  http.post(`${MOCK_API_BASE_URL}/files`, async ({ request }) => {
    const file = await readFileField(request)
    if (file === undefined) return refuse(400, 'multipart/form-data의 file 필드에 파일을 담아 보내 주세요.')
    const problem = findUploadProblem(file)
    if (problem !== undefined) return refuse(PROBLEM_STATUS[problem.reason], problem.message)

    if (file.name.includes('slow')) await delay(SLOW_RESPONSE_MS)
    if (file.name.includes('flaky') && !failedOnce.has(file.name)) {
      failedOnce.add(file.name)
      return refuse(503, '일시적인 오류로 파일을 받지 못했습니다.')
    }
    uploadedCount += 1
    return respond(
      {
        id: `file-${String(uploadedCount)}`,
        name: file.name,
        size: file.size,
        contentType: file.type,
      } satisfies UploadedFile,
      201,
    )
  }),
]

/** multipart/form-data 본문의 file 필드에 담긴 파일 */
interface FileField {
  name: string
  type: string
  size: number
}

/**
 * multipart/form-data 본문에서 file 필드의 파일 이름, 형식, 크기를 읽는다. request.formData()는 Vitest의 jsdom 환경에서 파일
 * 필드를 읽지 못하므로(jsdom의 File과 Node.js의 File이 달라 실패한다) 본문을 직접 나눈다.
 */
async function readFileField(request: Request): Promise<FileField | undefined> {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(request.headers.get('content-type') ?? '')
  const delimiter = boundary?.[1] ?? boundary?.[2]
  if (delimiter === undefined) return undefined
  const bytes = new Uint8Array(await request.arrayBuffer())
  // 바이트 하나를 글자 하나로 읽어, 글자의 위치가 바이트의 위치와 같게 한다.
  const text = new TextDecoder('latin1').decode(bytes)
  // 필드마다 `--<경계>\r\n<머리글>\r\n\r\n<내용>`이 이어지고, 내용 뒤의 `\r\n--<경계>`에서 다음 필드가 시작한다.
  let start = text.indexOf(`--${delimiter}\r\n`)
  while (start !== -1) {
    const contentEnd = text.indexOf(`\r\n--${delimiter}`, start)
    if (contentEnd === -1) return undefined
    const headerEnd = text.indexOf('\r\n\r\n', start)
    const headers = text.slice(start, headerEnd)
    const filename = /filename="([^"]*)"/.exec(headers)
    if (headerEnd !== -1 && headerEnd < contentEnd && /\bname="file"/.test(headers) && filename !== null) {
      // 파일 이름은 UTF-8로 온다.
      const nameStart = start + filename.index + 'filename="'.length
      const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + (filename[1] ?? '').length))
      const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() ?? ''
      return { name, type, size: contentEnd - (headerEnd + '\r\n\r\n'.length) }
    }
    start = text.indexOf(`--${delimiter}\r\n`, contentEnd)
  }
  return undefined
}
