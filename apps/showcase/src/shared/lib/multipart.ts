// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/file-upload/src/shared/lib/multipart.ts

// file-upload Recipe의 공용 유틸: multipart/form-data 본문 읽기(src/shared/lib/text.ts의 머리말).

/** multipart/form-data 본문의 파일 필드에 담긴 파일 */
export interface MultipartFile {
  name: string
  type: string
  size: number
}

/**
 * multipart/form-data 요청 본문에서 field 필드에 담긴 파일의 이름, 형식, 크기를 읽는다. 그런 필드가 없거나 본문이
 * multipart/form-data가 아니면 undefined다. field는 정규식 특수 문자가 없는 필드 이름이다. 파일을 받는 MSW 핸들러가 쓴다.
 * request.formData()는 Vitest의 jsdom 환경에서 파일 필드를 읽지 못하므로(jsdom의 File과 Node.js의 File이 달라 실패한다)
 * 본문을 직접 나눈다.
 */
export async function readMultipartFile(request: Request, field: string): Promise<MultipartFile | undefined> {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(request.headers.get('content-type') ?? '')
  const delimiter = boundary?.[1] ?? boundary?.[2]
  if (delimiter === undefined) return undefined
  // filename="..." 안의 name="..."은 필드 이름이 아니다.
  const fieldName = new RegExp(String.raw`\bname="${field}"`)
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
    if (headerEnd !== -1 && headerEnd < contentEnd && fieldName.test(headers) && filename !== null) {
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
