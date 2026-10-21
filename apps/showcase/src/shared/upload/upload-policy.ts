// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/file-upload/src/shared/upload/upload-policy.ts

// file-upload Recipe: 업로드 operation(uploadFile, POST /files)이 받는 파일. openapi.yaml의 uploadFile 설명(5MB)과
// encoding.file.contentType(받는 형식)에 적힌 값이다. 명세에 정해진 표기가 없어 재생성 계층이 만들지 않으므로 여기에 옮겨 두고,
// 백엔드가 기준을 바꾸면 명세와 함께 고친다. 업로더는 올리기 전에 이 기준으로 검사하고, 목 백엔드(src/shared/mocks/files.ts)도
// 같은 기준으로 거절한다.

/** 받는 가장 큰 파일(바이트) */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024

/** 받는 형식(MIME 타입)과 사용자에게 보여 줄 이름 */
export const UPLOAD_ACCEPTED_TYPES: Readonly<Record<string, string>> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'application/pdf': 'PDF',
  'text/plain': '텍스트',
}

/** 파일 입력의 accept 속성. 파일 고르기 창에서 받는 형식만 보이게 한다(끌어 놓은 파일은 걸러지지 않는다). */
export const UPLOAD_ACCEPT = Object.keys(UPLOAD_ACCEPTED_TYPES).join(',')

const SIZE_FORMAT = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 })

/** 바이트 수를 읽기 쉬운 크기로 바꾼다. 예: 512B, 1.5KB, 5MB */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)}B`
  const units = ['KB', 'MB', 'GB'] as const
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${SIZE_FORMAT.format(value)}${units[unit] ?? ''}`
}

/** 업로드 operation이 받지 않는 파일의 이유 */
export interface UploadProblem {
  /** too-large는 413, unsupported-type은 415로 거절된다. */
  reason: 'too-large' | 'unsupported-type'
  message: string
}

/** 업로드 operation이 받지 않는 파일이면 그 이유를, 받는 파일이면 undefined를 돌려준다. */
export function findUploadProblem({ size, type }: { size: number; type: string }): UploadProblem | undefined {
  if (!Object.hasOwn(UPLOAD_ACCEPTED_TYPES, type)) {
    return {
      reason: 'unsupported-type',
      message: `${Object.values(UPLOAD_ACCEPTED_TYPES).join(', ')} 파일만 올릴 수 있습니다.`,
    }
  }
  if (size > UPLOAD_MAX_BYTES) {
    return { reason: 'too-large', message: `${formatFileSize(UPLOAD_MAX_BYTES)} 이하의 파일만 올릴 수 있습니다.` }
  }
  return undefined
}
