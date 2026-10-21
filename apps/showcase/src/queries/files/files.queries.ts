// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/file-upload/src/queries/files/files.queries.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getUploadFileUrl } from '@/shared/api/generated'
import { type FileUpload, UploadedFile } from '@/shared/api/generated/model'
import { apiUpload, type UploadProgress } from '@/shared/upload/api-upload'
import { filesKeys } from './files.keys'

// files Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

/** useUploadFileMutation의 mutate에 넘기는 값 */
export interface UploadFileVariables {
  fileUpload: FileUpload
  /** 본문을 보내는 동안 보낸 바이트 수를 받는다. */
  onProgress?: ((progress: UploadProgress) => void) | undefined
  /** abort하면 업로드를 멈추고 뮤테이션이 AbortError로 실패한다. */
  signal?: AbortSignal | undefined
}

// file-upload Recipe: `npm run g -- mutation uploadFile`이 만든 훅에서 요청을 보내는 부분만 바꿨다. 생성된 fetch 함수(uploadFile)는
// fetch로 보내 진행률을 알 수 없으므로, 같은 요청(operation의 경로, multipart 본문의 file 필드, 응답 스키마)을 XMLHttpRequest로
// 보내는 apiUpload로 보내고, 진행률과 취소(signal)를 mutate에 넘긴 값으로 받는다.
export function useUploadFileMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ fileUpload, onProgress, signal }: UploadFileVariables) => {
      const body = new FormData()
      body.append('file', fileUpload.file)
      return apiUpload(getUploadFileUrl(), { body, schema: UploadedFile, onProgress, signal })
    },
    // 성공하면 files Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...filesKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: filesKeys.all }),
  })
}
