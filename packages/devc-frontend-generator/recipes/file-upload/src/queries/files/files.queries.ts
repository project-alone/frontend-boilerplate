import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getUploadFileUrl } from '@/shared/api/generated'
import { type FileUpload, UploadedFile } from '@/shared/api/generated/model'
import { apiUpload, type ApiUploadInit } from '@/shared/upload/api-upload'
import { filesKeys } from './files.keys'

// files Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

/** useUploadFileMutation의 mutate에 넘기는 값. 진행률(onProgress)과 취소(signal)는 apiUpload에 그대로 넘긴다. */
export interface UploadFileVariables extends Pick<ApiUploadInit<UploadedFile>, 'onProgress' | 'signal'> {
  fileUpload: FileUpload
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
    // 브라우저가 오프라인이라고 알려도 멈춰 기다리지 않고 바로 보낸다. 기본값(online)이면 요청을 보내기 전에 멈춰, 사용자가 취소하거나
    // 실패를 보고 다시 시도할 수 없다.
    networkMode: 'always',
    // 성공하면 files Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...filesKeys.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: filesKeys.all }),
  })
}
