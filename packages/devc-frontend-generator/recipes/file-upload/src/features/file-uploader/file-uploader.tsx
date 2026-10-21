'use client'

import { Progress } from '@base-ui/react/progress'
import { cx } from 'class-variance-authority'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import {
  formatFileSize,
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPTED_TYPE_NAMES,
  UPLOAD_MAX_BYTES,
} from '@/shared/upload/upload-policy'
import { type Upload, type UploadStatus, useUploads } from './use-uploads'

// file-upload Recipe: 파일을 고르거나 끌어 놓아 올리는 업로더. 파일마다 진행률을 보여 주고, 올리는 중에는 취소하고, 실패하거나
// 취소한 업로드는 다시 시도한다. 받지 않는 크기·형식의 파일은 보내지 않고 이유를 알린다(src/shared/upload/upload-policy.ts).

const POLICY_HINT = `${UPLOAD_ACCEPTED_TYPE_NAMES} 파일을 ${formatFileSize(UPLOAD_MAX_BYTES)}까지 올릴 수 있습니다.`

// 알림 영역에 남겨 두는 최근 알림의 수
const ANNOUNCEMENT_COUNT = 5

/**
 * 파일 업로더. 파일 선택 버튼(키보드로 누를 수 있다)이나 끌어 놓기로 여러 파일을 한꺼번에 더하고, 파일마다 따로 올린다.
 * 진행률은 진행 막대(role="progressbar")의 값으로 보여 주고, 업로드가 끝나거나 거절되면 알림 영역(role="status")으로 알린다.
 */
export function FileUploader() {
  const { uploads, add, cancel, retry, remove } = useUploads()
  const inputRef = useRef<HTMLInputElement>(null)
  const pickButtonRef = useRef<HTMLButtonElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const hintId = useId()

  return (
    <div className="flex flex-col gap-4">
      {/*
        끌어 놓기는 마우스로만 할 수 있는 보조 수단이라, 같은 일을 하는 파일 선택 버튼을 안에 둔다. 놓는 곳은 보조 기술에 따로
        드러내지 않는다(role="presentation", react-dropzone과 같은 방식).
      */}
      <div
        role="presentation"
        data-dragging={isDragging ? '' : undefined}
        className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-6 text-center data-dragging:border-primary data-dragging:bg-muted"
        onDragOver={(event) => {
          // 기본 동작(파일을 브라우저에서 열기)을 막아야 drop이 일어난다.
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            setIsDragging(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          add(event.dataTransfer.files)
        }}
      >
        <p id={hintId} className="text-sm text-muted-foreground">
          파일을 여기에 끌어 놓거나 파일 선택 버튼으로 고르세요. {POLICY_HINT}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          aria-label="올릴 파일"
          hidden
          onChange={(event) => {
            add(event.currentTarget.files ?? [])
            // 같은 파일을 다시 골라도 change가 일어나도록 비운다.
            event.currentTarget.value = ''
          }}
        />
        <Button ref={pickButtonRef} aria-describedby={hintId} onClick={() => inputRef.current?.click()}>
          파일 선택
        </Button>
      </div>
      {uploads.length > 0 && (
        <ul aria-label="업로드 목록" className="flex flex-col gap-2">
          {uploads.map((upload) => (
            <UploadItem
              key={upload.id}
              upload={upload}
              onCancel={() => {
                cancel(upload.id)
              }}
              onRetry={() => {
                retry(upload.id)
              }}
              onRemove={() => {
                remove(upload.id)
                // 누른 버튼이 항목과 함께 사라지므로 포커스를 파일 선택 버튼으로 옮긴다.
                pickButtonRef.current?.focus()
              }}
            />
          ))}
        </ul>
      )}
      <UploadAnnouncer uploads={uploads} />
    </div>
  )
}

/**
 * 업로드가 끝나거나(올림, 실패, 취소) 거절될 때마다 "<파일 이름>: <상태 문구>"를 보조 기술에 읽어 준다. 알림 영역은 내용이 바뀌어야
 * 읽히므로 항목과 함께 생기지 않도록 처음부터 비워 둔다. 알림을 덧붙이고(aria-atomic="false") 새로 붙은 알림만 읽히게 한다.
 * 진행률은 바뀔 때마다 읽으면 다른 내용을 들을 수 없으므로 알리지 않는다. 진행 막대의 값으로 언제든 읽을 수 있다.
 */
function UploadAnnouncer({ uploads }: Readonly<{ uploads: readonly Upload[] }>) {
  // 업로드마다 마지막으로 본 상태. 올리는 중이 아닌 상태로 바뀐 업로드만 알린다.
  const lastStatuses = useRef(new Map<number, UploadStatus>())
  const nextKey = useRef(0)
  const [announcements, setAnnouncements] = useState<readonly { key: number; text: string }[]>([])

  useEffect(() => {
    const settled = uploads.filter(
      ({ id, status }) => status !== 'uploading' && lastStatuses.current.get(id) !== status,
    )
    lastStatuses.current = new Map(uploads.map(({ id, status }) => [id, status]))
    if (settled.length === 0) return
    const added = settled.map((upload) => {
      nextKey.current += 1
      return { key: nextKey.current, text: `${upload.file.name}: ${statusMessage(upload)}` }
    })
    setAnnouncements((current) => [...current, ...added].slice(-ANNOUNCEMENT_COUNT))
  }, [uploads])

  return (
    <div role="status" aria-atomic="false" className="sr-only">
      {announcements.map(({ key, text }) => (
        <p key={key}>{text}</p>
      ))}
    </div>
  )
}

interface UploadItemProps {
  upload: Upload
  onCancel: () => void
  onRetry: () => void
  onRemove: () => void
}

function UploadItem({ upload, onCancel, onRetry, onRemove }: Readonly<UploadItemProps>) {
  const { file, status } = upload
  const nameId = useId()
  // 취소와 다시 시도는 같은 자리의 같은 버튼이라, 누른 뒤 상태가 바뀌어도 포커스가 그 버튼에 남는다.
  const action =
    status === 'uploading'
      ? { label: '취소', name: `${file.name} 업로드 취소`, onClick: onCancel }
      : status === 'failed' || status === 'canceled'
        ? { label: '다시 시도', name: `${file.name} 다시 시도`, onClick: onRetry }
        : undefined

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={nameId} className="font-medium break-all">
          {file.name}
        </span>
        <span className="text-sm text-muted-foreground">{formatFileSize(file.size)}</span>
      </div>
      {status === 'uploading' && <UploadProgressBar nameId={nameId} progress={upload.progress} />}
      <p className={cx('text-sm', (status === 'failed' || status === 'rejected') && 'text-danger')}>
        {statusMessage(upload)}
      </p>
      <div className="flex gap-2">
        {action !== undefined && (
          <Button
            key="action"
            variant="secondary"
            size="sm"
            aria-label={action.name}
            onClick={(event) => {
              // 더블 클릭의 두 번째 클릭이 바뀐 동작(취소한 뒤의 다시 시도)을 누르지 않게 한다. 키보드로 누르면 detail은 0이다.
              if (event.detail <= 1) action.onClick()
            }}
          >
            {action.label}
          </Button>
        )}
        {status !== 'uploading' && (
          <Button key="remove" variant="secondary" size="sm" aria-label={`${file.name} 지우기`} onClick={onRemove}>
            지우기
          </Button>
        )}
      </div>
    </li>
  )
}

/** 요청 본문을 보낸 정도. 진행 막대의 이름은 "<파일 이름> 업로드 진행률"이다. */
function UploadProgressBar({ nameId, progress }: Readonly<{ nameId: string; progress: number }>) {
  const labelId = useId()
  return (
    <Progress.Root
      value={Math.floor(progress * 100)}
      locale="ko-KR"
      aria-labelledby={`${nameId} ${labelId}`}
      className="flex flex-col gap-1"
    >
      <div className="flex justify-between text-sm">
        <span id={labelId}>업로드 진행률</span>
        <Progress.Value />
      </div>
      <Progress.Track className="h-2 overflow-hidden rounded-sm border border-border bg-muted">
        <Progress.Indicator className="h-full bg-primary transition-[width]" />
      </Progress.Track>
    </Progress.Root>
  )
}

function statusMessage({ status, progress, error }: Upload): string {
  switch (status) {
    case 'rejected':
      return `올릴 수 없는 파일입니다. ${error ?? ''}`
    case 'uploading':
      // 본문을 다 보낸 뒤에는 백엔드의 응답을 기다린다.
      return progress < 1 ? '올리는 중입니다.' : '서버가 파일을 받는 중입니다.'
    case 'succeeded':
      return '올렸습니다.'
    case 'failed':
      return `올리지 못했습니다. ${error ?? ''}`
    case 'canceled':
      return '업로드를 취소했습니다.'
  }
}
