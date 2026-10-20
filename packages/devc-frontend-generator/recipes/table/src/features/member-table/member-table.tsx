'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  type ColumnFiltersState,
  columnFilteringFeature,
  createColumnHelper,
  globalFilteringFeature,
  type PaginationState,
  rowPaginationFeature,
  rowSortingFeature,
  type SortDirection,
  type SortingState,
  tableFeatures,
  type Updater,
  useTable,
} from '@tanstack/react-table'
import { useState } from 'react'
import { listMembersQueryOptions } from '@/queries/members/members.queries'
import { ListMembersParams, type Member, type MemberPage, MemberRole } from '@/shared/api/generated/model'
import { Button } from '@/shared/ui/button'
import { Field, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'

// table Recipe: 회원 목록(listMembers)을 TanStack Table로 보여 준다. 정렬·필터·페이지는 백엔드가 처리하므로(manual*)
// 테이블은 그 상태만 들고, 상태를 쿼리 파라미터로 바꿔 쿼리 키와 요청에 함께 담는다(toListMembersParams).
// 상태가 바뀌면 쿼리 키가 바뀌어 새로 요청하고, 같은 상태로 돌아오면 캐시된 결과를 먼저 보여 준다.

const PAGE_SIZE = 10

const ROLE_LABELS: Record<MemberRole, string> = { admin: '관리자', editor: '편집자', viewer: '뷰어' }

// 역할 필터의 선택지. 역할이 아닌 값(all)을 고르면 필터를 지운다.
const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  ...MemberRole.options.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
]

// 테이블에 넣을 기능. 행을 정렬·필터·페이지로 나누는 일(row model)은 백엔드가 하므로 상태와 API만 쓴다.
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
})

// 정렬한 열의 id(accessor 이름)가 그대로 정렬 파라미터(sort)가 되므로, 명세의 sort에 없는 열(역할)은 정렬을 끈다.
const columnHelper = createColumnHelper<typeof features, Member>()
const columns = columnHelper.columns([
  columnHelper.accessor('name', { header: '이름' }),
  columnHelper.accessor('email', { header: '이메일' }),
  columnHelper.accessor('role', { header: '역할', cell: (info) => ROLE_LABELS[info.getValue()], enableSorting: false }),
  columnHelper.accessor('joinedAt', { header: '가입일' }),
])

// 데이터를 받기 전에 넘기는 빈 목록. 렌더링할 때마다 새 배열을 넘기면 테이블이 행을 매번 다시 만든다.
const NO_MEMBERS: Member[] = []

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const satisfies Record<SortDirection, string>

interface MemberTableState {
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: string
  pagination: PaginationState
}

/** 역할 열에 건 필터의 값. 걸지 않았으면 undefined다. */
function roleFilterOf(columnFilters: ColumnFiltersState): MemberRole | undefined {
  return MemberRole.safeParse(columnFilters.find(({ id }) => id === 'role')?.value).data
}

/** 테이블의 상태를 listMembers의 쿼리 파라미터로 바꾼다. 쿼리 키(membersKeys.listMembers)도 이 값으로 정해진다. */
function toListMembersParams({
  sorting,
  columnFilters,
  globalFilter,
  pagination,
}: MemberTableState): ListMembersParams {
  const [sorted] = sorting
  const sort = ListMembersParams.shape.sort.safeParse(sorted?.id).data
  const role = roleFilterOf(columnFilters)
  const q = globalFilter.trim()
  return {
    ...(q === '' ? {} : { q }),
    ...(role === undefined ? {} : { role }),
    ...(sort === undefined ? {} : { sort, order: sorted?.desc === true ? 'desc' : 'asc' }),
    // 테이블은 페이지를 0부터, 명세는 1부터 센다.
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  }
}

/** 받은 페이지가 거른 회원 가운데 몇 번째부터 몇 번째까지인지 알린다. */
function summary({ items, total, page, pageSize }: MemberPage): string {
  if (total === 0) return '조건에 맞는 회원이 없습니다.'
  const first = (page - 1) * pageSize + 1
  return `회원 ${String(total)}명 중 ${String(first)}–${String(first + items.length - 1)}번째`
}

/**
 * 회원 목록 테이블. 열 머리글의 버튼으로 정렬하고(오름차순 → 내림차순 → 정렬 없음), 검색어와 역할로 거르고, 페이지를
 * 넘긴다. 모두 키보드로 조작할 수 있고, 정렬 상태는 열 머리글의 aria-sort로, 결과는 상태 문구로 알린다.
 */
export function MemberTable() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })
  const { data, isError, isPlaceholderData } = useQuery({
    ...listMembersQueryOptions(toListMembersParams({ sorting, columnFilters, globalFilter, pagination })),
    // 다음 결과를 받는 동안 지금 결과를 그대로 보여 준다.
    placeholderData: keepPreviousData,
  })

  // 정렬이나 필터가 바뀌면 결과가 달라지므로 첫 페이지로 돌아간다.
  const backToFirstPage = () => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }
  const table = useTable({
    features,
    columns,
    data: data?.items ?? NO_MEMBERS,
    rowCount: data?.total ?? 0,
    getRowId: (member) => String(member.id),
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: (updater) => {
      setSorting(updater)
      backToFirstPage()
    },
    onColumnFiltersChange: (updater) => {
      setColumnFilters(updater)
      backToFirstPage()
    },
    onGlobalFilterChange: (updater: Updater<string>) => {
      setGlobalFilter(updater)
      backToFirstPage()
    },
    onPaginationChange: setPagination,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    // 백엔드는 한 열로만 정렬한다. 열마다 오름차순부터 시작한다.
    enableMultiSort: false,
    sortDescFirst: false,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <form
          role="search"
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const keyword = new FormData(event.currentTarget).get('q')
            table.setGlobalFilter(typeof keyword === 'string' ? keyword : '')
          }}
        >
          <Field>
            <FieldLabel>이름·이메일 검색</FieldLabel>
            <Input name="q" type="search" />
          </Field>
          <Button type="submit" variant="secondary">
            검색
          </Button>
        </form>
        <Select
          label="역할"
          options={ROLE_FILTER_OPTIONS}
          value={roleFilterOf(columnFilters) ?? 'all'}
          className="w-40"
          onValueChange={(value) => {
            table.getColumn('role')?.setFilterValue(MemberRole.safeParse(value).data)
          }}
        />
      </div>
      <p role="status">{data === undefined ? (isError ? '' : '회원을 불러오는 중입니다.') : summary(data)}</p>
      {isError && <p role="alert">회원 목록을 불러오지 못했습니다.</p>}
      {data !== undefined && !isError && (
        <>
          <table className="w-full border-collapse text-left" aria-busy={isPlaceholderData}>
            <caption className="mb-2 text-left font-semibold">회원 목록</caption>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={sorted === false ? undefined : ARIA_SORT[sorted]}
                        className="border-b border-border px-3 py-2 text-sm font-medium"
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="focus-ring inline-flex items-center gap-1 rounded-sm font-medium"
                          >
                            <table.FlexRender header={header} />
                            <SortIcon direction={sorted} />
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="border-b border-border px-3 py-2">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
              {data.total === 0 && (
                <tr>
                  <td colSpan={columns.length} className="border-b border-border px-3 py-2 text-muted-foreground">
                    조건에 맞는 회원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <nav aria-label="회원 목록 페이지" className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => {
                table.previousPage()
              }}
            >
              이전
            </Button>
            <span className="text-sm">
              {pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}쪽
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => {
                table.nextPage()
              }}
            >
              다음
            </Button>
          </nav>
        </>
      )}
    </div>
  )
}

/** 정렬 방향을 보여 주는 장식용 아이콘. 스크린 리더는 열 머리글의 aria-sort로 정렬 방향을 듣는다. */
function SortIcon({ direction }: Readonly<{ direction: SortDirection | false }>) {
  const path = { asc: 'm4 10 4-4 4 4', desc: 'm4 6 4 4 4-4', none: 'm5 6 3-3 3 3M5 10l3 3 3-3' }[direction || 'none']
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
      <path d={path} />
    </svg>
  )
}
