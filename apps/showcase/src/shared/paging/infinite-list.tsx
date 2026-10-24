// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/shared/paging/infinite-list.tsx

'use client'

import { type Key, type ReactNode, useEffect, useEffectEvent, useRef } from 'react'
import { Button } from '@/shared/ui/button'

// infinite-list Recipe: 페이지를 차례로 불러와 이어 붙이는 목록(무한 스크롤). useInfiniteQuery의 결과를 받아 그리기만 하므로
// 어느 Query Domain의 infiniteQueryOptions와도 쓸 수 있다(src/features/article-list/article-infinite-list.tsx 참고).

/** 목록 끝이 화면 아래에서 이만큼 남았을 때 미리 다음 페이지를 불러온다. */
const LOAD_AHEAD_MARGIN = '0px 0px 200px 0px'

export interface InfiniteListProps<T> {
  /** 목록이 담은 것의 이름. 목록의 이름(`<이름> 목록`)과 상태 문구에 쓴다. 예: '게시글' */
  itemName: string
  /** 지금까지 불러온 항목. 첫 페이지를 받기 전에는 undefined다. */
  items: readonly T[] | undefined
  getKey: (item: T) => Key
  renderItem: (item: T) => ReactNode
  /** 다음 페이지가 있다(useInfiniteQuery의 hasNextPage). */
  hasNextPage: boolean
  /** 다음 페이지를 불러오는 중이다(useInfiniteQuery의 isFetchingNextPage). */
  isFetchingNextPage: boolean
  /** 마지막 요청이 실패했다. 첫 페이지가 실패했으면 items가 undefined다. */
  isError: boolean
  /** 다음 페이지를 불러온다(fetchNextPage). 목록 끝이 화면에 들어오거나 더 보기 버튼을 누르면 부른다. */
  onLoadMore: () => void
  /** 실패한 요청을 다시 보낸다. 첫 페이지면 refetch, 다음 페이지면 fetchNextPage다. */
  onRetry: () => void
}

/**
 * 무한 스크롤 목록. 목록 끝이 화면에 들어오면(IntersectionObserver) 다음 페이지를 불러와 이어 붙이고, 빈 페이지를 받아
 * 다음 페이지가 없으면 멈춘다. 스크롤하지 않는 키보드·스크린 리더 사용자는 목록 끝의 더 보기 버튼으로 불러온다.
 *
 * - 더 보기 버튼으로 불러오면 새로 불러온 첫 항목으로 포커스를 옮겨, 이어서 읽을 수 있게 한다. 스크롤로 불러올 때는 옮기지 않는다.
 * - 더 보기 버튼에 포커스가 있는 동안에는 스크롤로 불러오지 않는다. 버튼에 온 키보드 사용자가 직접 불러오게 한다.
 * - 요청이 실패하면 알리고 스크롤로는 더 불러오지 않는다. 같은 자리의 버튼이 다시 시도 버튼이 된다.
 */
export function InfiniteList<T>({
  itemName,
  items,
  getKey,
  renderItem,
  hasNextPage,
  isFetchingNextPage,
  isError,
  onLoadMore,
  onRetry,
}: InfiniteListProps<T>) {
  const listRef = useRef<HTMLUListElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  // 버튼으로 불러오기 시작할 때의 항목 수. 그 자리(새로 불러온 첫 항목)로 포커스를 옮긴 뒤 지운다.
  const focusFromRef = useRef<number | undefined>(undefined)
  const count = items?.length ?? 0

  const loadMoreOnScroll = useEffectEvent(() => {
    if (buttonRef.current !== null && buttonRef.current === document.activeElement) return
    onLoadMore()
  })
  // 불러오는 중이거나 실패했으면 지켜보지 않는다. 다 불러온 뒤 다시 지켜볼 때 목록 끝이 아직 화면에 있으면(목록이 화면보다
  // 짧으면) 바로 알려지므로 화면이 찰 때까지 이어서 불러온다.
  const watchesEnd = items !== undefined && hasNextPage && !isFetchingNextPage && !isError
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!watchesEnd || sentinel === null) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreOnScroll()
      },
      { rootMargin: LOAD_AHEAD_MARGIN },
    )
    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [watchesEnd])

  useEffect(() => {
    const from = focusFromRef.current
    if (from === undefined) return
    const firstNew = listRef.current?.children.item(from)
    if (firstNew instanceof HTMLElement) {
      focusFromRef.current = undefined
      firstNew.focus()
    } else if (!hasNextPage && !isFetchingNextPage && !isError) {
      // 빈 페이지를 받아 새 항목 없이 끝났으면 버튼이 사라지므로, 다 불러왔다는 문구로 포커스를 옮긴다.
      focusFromRef.current = undefined
      statusRef.current?.focus()
    }
  }, [count, hasNextPage, isFetchingNextPage, isError])

  const showsButton = isError || (items !== undefined && hasNextPage)
  // 지금 상태를 알리는 문구. 목록 끝의 상태 문구(role="status")로 보여 주고 스크린 리더에도 알린다. 실패했으면 비워 두고 오류
  // 문구(role="alert")로 알린다.
  let status = ''
  if (!isError) {
    if (items === undefined) status = `${itemName} 목록을 불러오는 중입니다.`
    else if (isFetchingNextPage) status = '다음 페이지를 불러오는 중입니다.'
    else if (items.length === 0) status = `${itemName} 목록이 비어 있습니다.`
    else if (hasNextPage) status = `${itemName} ${String(items.length)}개를 불러왔습니다.`
    else status = `${itemName} ${String(items.length)}개를 모두 불러왔습니다.`
  }

  return (
    <div className="flex flex-col gap-4">
      {items !== undefined && items.length > 0 && (
        <ul
          ref={listRef}
          aria-label={`${itemName} 목록`}
          aria-busy={isFetchingNextPage}
          className="flex flex-col gap-3"
        >
          {items.map((item) => (
            <li key={getKey(item)} tabIndex={-1} className="focus-ring rounded-md">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
      {items !== undefined && hasNextPage && <div ref={sentinelRef} aria-hidden="true" />}
      <p ref={statusRef} role="status" tabIndex={-1} className="focus-ring rounded-sm text-sm text-muted-foreground">
        {status}
      </p>
      {isError && (
        <p role="alert" className="text-sm text-danger">
          {items === undefined ? `${itemName} 목록을 불러오지 못했습니다.` : '다음 페이지를 불러오지 못했습니다.'}
        </p>
      )}
      {showsButton && (
        // 더 보기와 다시 시도는 같은 버튼이라, 누른 뒤 실패해도 포커스가 버튼에 남는다.
        <Button
          ref={buttonRef}
          variant="secondary"
          className="self-center"
          disabled={isFetchingNextPage}
          focusableWhenDisabled
          onClick={() => {
            focusFromRef.current = count
            if (isError) onRetry()
            else onLoadMore()
          }}
        >
          {isError ? '다시 시도' : '더 보기'}
        </Button>
      )}
    </div>
  )
}
