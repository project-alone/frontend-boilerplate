// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/file-upload/src/shared/upload/upload-policy.test.ts

// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { UPLOAD_ACCEPTED_TYPES, UPLOAD_MAX_BYTES } from './upload-policy'

// 업로드 기준은 재생성 계층이 만들지 않아 명세에서 손으로 옮겨 두었다(upload-policy.ts). 백엔드의 명세가 바뀌었는데 이 파일을
// 고치지 않으면 여기서 실패한다. Starter 최상위의 openapi.yaml(Base와 Recipe의 명세를 병합한 명세)을 읽는다.
const spec = readFileSync('openapi.yaml', 'utf8')

test('받는 형식은 명세의 uploadFile이 file 필드에 받는 형식(encoding.file.contentType)과 같다', () => {
  const contentType = /encoding:\s*\n\s*file:\s*\n(?:\s*#.*\n)*\s*contentType:\s*(.+)/.exec(spec)?.[1]

  expect(contentType?.split(',').map((type) => type.trim())).toEqual(Object.keys(UPLOAD_ACCEPTED_TYPES))
})

test('받는 가장 큰 크기는 명세의 uploadFile이 file 필드에 적은 크기(x-max-bytes)와 같다', () => {
  const maxBytes = /x-max-bytes:\s*(\d+)/.exec(spec)?.[1]

  expect(Number(maxBytes)).toBe(UPLOAD_MAX_BYTES)
})
