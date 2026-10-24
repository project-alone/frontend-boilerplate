// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/file-upload/src/features/file-uploader/use-uploads.ts

import { useEffect, useRef, useState } from 'react'
import { useUploadFileMutation } from '@/queries/files/files.queries'
import { apiErrorMessage } from '@/shared/api/api-fetch'
import { UploadError } from '@/shared/api/generated/model'
import { findUploadProblem } from '@/shared/upload/upload-policy'

/**
 * 업로드 하나의 상태
 * - rejected: 올리기 전 검사(크기·형식)에서 걸러져 보내지 않았다.
 * - uploading: 보내는 중이거나, 다 보내고 응답을 기다린다.
 * - succeeded, failed: 백엔드가 받았거나, 거절했거나 네트워크 오류로 실패했다.
 * - canceled: 사용자가 취소했다.
 */
export type UploadStatus = 'rejected' | 'uploading' | 'succeeded' | 'failed' | 'canceled'

export interface Upload {
  id: number
  file: File
  status: UploadStatus
  /** 요청 본문을 보낸 비율(0~1) */
  progress: number
  /** rejected, failed의 이유 */
  error?: string | undefined
}

/**
 * 업로드 목록. 더한 파일을 검사해 받는 파일만 바로 올리고, 파일마다 진행률·취소·재시도를 따로 다룬다.
 * 요청은 files Query Domain의 뮤테이션(useUploadFileMutation)으로 보낸다. 컴포넌트가 사라지면 올리던 요청을 모두 취소한다.
 */
export function useUploads() {
  const { mutateAsync } = useUploadFileMutation()
  const [uploads, setUploads] = useState<readonly Upload[]>([])
  const nextId = useRef(0)
  // 올리는 중인 업로드의 취소 수단
  const controllers = useRef(new Map<number, AbortController>())

  useEffect(() => {
    const running = controllers.current
    return () => {
      for (const controller of running.values()) controller.abort()
    }
  }, [])

  const update = (id: number, patch: Partial<Omit<Upload, 'id' | 'file'>>) => {
    setUploads((current) => current.map((upload) => (upload.id === id ? { ...upload, ...patch } : upload)))
  }

  const start = (id: number, file: File) => {
    const controller = new AbortController()
    controllers.current.set(id, controller)
    update(id, { status: 'uploading', progress: 0, error: undefined })
    void mutateAsync({
      fileUpload: { file },
      signal: controller.signal,
      onProgress: ({ loaded, total }) => {
        update(id, { progress: loaded / total })
      },
    })
      .then(
        () => {
          update(id, { status: 'succeeded', progress: 1 })
        },
        (error: unknown) => {
          // 백엔드가 명세의 UploadError로 이유를 알려 주면 그 문구를 쓴다.
          const reason = apiErrorMessage(error, UploadError) ?? '잠시 뒤 다시 시도해 주세요.'
          update(id, controller.signal.aborted ? { status: 'canceled' } : { status: 'failed', error: reason })
        },
      )
      .finally(() => {
        if (controllers.current.get(id) === controller) controllers.current.delete(id)
      })
  }

  return {
    uploads,
    /** 파일을 목록에 더하고, 업로드 operation이 받는 파일이면 바로 올린다. */
    add: (files: Iterable<File>) => {
      const added = Array.from(files, (file): Upload => {
        nextId.current += 1
        const problem = findUploadProblem(file)
        return problem === undefined
          ? { id: nextId.current, file, status: 'uploading', progress: 0 }
          : { id: nextId.current, file, status: 'rejected', progress: 0, error: problem.message }
      })
      setUploads((current) => [...current, ...added])
      for (const { id, file, status } of added) if (status === 'uploading') start(id, file)
    },
    cancel: (id: number) => {
      controllers.current.get(id)?.abort()
    },
    /** 실패하거나 취소한 업로드를 처음부터 다시 올린다. */
    retry: (id: number) => {
      const upload = uploads.find((candidate) => candidate.id === id)
      if (upload !== undefined) start(id, upload.file)
    },
    /** 목록에서 지운다. 올리는 중이면 취소한다. */
    remove: (id: number) => {
      controllers.current.get(id)?.abort()
      setUploads((current) => current.filter((upload) => upload.id !== id))
    },
  }
}
