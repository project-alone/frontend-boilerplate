import { Button } from '@/shared/ui/button'

// infinite-list Recipe: 번호형 페이지네이션. 쪽 상태는 부르는 쪽이 들고, 이 컴포넌트는 쪽 번호를 그리고 바꿀 쪽을 알리기만 한다
// (src/features/article-list/article-paged-list.tsx 참고).

/** 지금 쪽의 앞뒤로 보여 줄 쪽 수 */
const SIBLINGS = 1
/** 첫 쪽, 마지막 쪽, 지금 쪽과 앞뒤 쪽, 줄임표 두 개. 쪽이 이보다 적으면 줄이지 않는다. */
const MAX_ITEMS = 2 * SIBLINGS + 5

type PageItem = number | 'gap'

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

/**
 * 보여 줄 쪽 번호와 줄임표('gap'). 첫 쪽과 마지막 쪽, 지금 쪽과 그 앞뒤 쪽을 보여 주고 나머지는 줄임표로 줄인다.
 * 지금 쪽이 어디에 있든 항목 수(MAX_ITEMS)가 같아 쪽을 옮겨도 버튼의 자리가 크게 흔들리지 않는다.
 */
function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= MAX_ITEMS) return range(1, pageCount)
  const edge = MAX_ITEMS - 2 // 한쪽 끝에 붙어 줄임표 없이 보여 줄 쪽 수
  if (page - SIBLINGS <= 3) return [...range(1, edge), 'gap', pageCount]
  if (page + SIBLINGS >= pageCount - 2) return [1, 'gap', ...range(pageCount - edge + 1, pageCount)]
  return [1, 'gap', ...range(page - SIBLINGS, page + SIBLINGS), 'gap', pageCount]
}

export interface PaginationProps {
  /** 페이지 이동 영역(nav)의 이름. 예: '게시글 목록 페이지' */
  label: string
  /** 지금 쪽(1부터 센다) */
  page: number
  /** 전체 쪽 수 */
  pageCount: number
  onPageChange: (page: number) => void
}

/**
 * 이전·다음 버튼과 쪽 번호 버튼. 지금 쪽은 aria-current로 알리고, 쪽 번호 버튼은 "3 쪽"처럼 읽힌다.
 * 쪽을 주소(?page=3)에 담아 링크로 만들려면 버튼 대신 next/link를 쓰고 page를 주소에서 읽는다.
 */
export function Pagination({ label, page, pageCount, onPageChange }: PaginationProps) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              onPageChange(page - 1)
            }}
          >
            이전
          </Button>
        </li>
        {pageItems(page, pageCount).map((item, index) =>
          item === 'gap' ? (
            // 줄임표는 두 개까지 있을 수 있어 자리로 구별한다.
            <li key={`gap-${String(index)}`} aria-hidden="true" className="px-2 text-sm text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              {/* 화면에는 번호만 보이고 스크린 리더는 "3 쪽"으로 읽는다. 음성으로 누를 수 있도록 보이는 번호가 이름에 한 낱말로 들어 있다. */}
              <Button
                variant={item === page ? 'primary' : 'secondary'}
                size="sm"
                aria-label={`${String(item)} 쪽`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => {
                  if (item !== page) onPageChange(item)
                }}
              >
                {item}
              </Button>
            </li>
          ),
        )}
        <li>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => {
              onPageChange(page + 1)
            }}
          >
            다음
          </Button>
        </li>
      </ul>
    </nav>
  )
}
