// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/features/user-table/user-table.tsx

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
import Link from 'next/link'
import { useState } from 'react'
import { listUsersQueryOptions } from '@/queries/users/users.queries'
import { ListUsersParams, Role, type UserAccount, UserStatus } from '@/shared/api/generated/model'
import { editUserPath } from '@/shared/dashboard/dashboard-routes'
import { ROLE_LABELS, ROLE_OPTIONS, USER_STATUS_LABELS, USER_STATUS_OPTIONS } from '@/shared/dashboard/user-labels'
import { Button } from '@/shared/ui/button'
import { Field, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { SortIcon } from '@/shared/ui/sort-icon'

// 대시보드 Archetype: 사용자 목록(listUsers)을 TanStack Table로 보여 준다. table Recipe의 회원 테이블
// (src/features/member-table)을 복사해 열 정의, 쿼리 파라미터, queryOptions를 바꾼 것이다. 정렬·필터·페이지는
// 백엔드가 처리하므로(manual*) 테이블은 그 상태만 들고, 상태를 쿼리 파라미터로 바꿔 쿼리 키와 요청에 함께 담는다.

const PAGE_SIZE = 10

// 필터의 선택지. 역할이나 상태가 아닌 값(ALL)을 고르면 그 필터를 지운다.
const ALL = 'all'
const ROLE_FILTER_OPTIONS = [{ value: ALL, label: '전체' }, ...ROLE_OPTIONS]
const STATUS_FILTER_OPTIONS = [{ value: ALL, label: '전체' }, ...USER_STATUS_OPTIONS]

// 테이블에 넣을 기능. 행을 정렬·필터·페이지로 나누는 일(row model)은 백엔드가 하므로 상태와 API만 쓴다.
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
})

// 정렬한 열의 id(accessor 이름)가 그대로 정렬 파라미터(sort)가 되므로, 명세의 sort에 없는 열은 정렬을 끈다.
const columnHelper = createColumnHelper<typeof features, UserAccount>()
const viewColumns = columnHelper.columns([
  columnHelper.accessor('name', { header: '이름' }),
  columnHelper.accessor('email', { header: '이메일' }),
  columnHelper.accessor('role', { header: '역할', cell: (info) => ROLE_LABELS[info.getValue()], enableSorting: false }),
  columnHelper.accessor('status', {
    header: '상태',
    cell: (info) => USER_STATUS_LABELS[info.getValue()],
    enableSorting: false,
  }),
  columnHelper.accessor('department', { header: '부서', cell: (info) => info.getValue() ?? '-', enableSorting: false }),
  columnHelper.accessor('joinedAt', { header: '추가한 날' }),
])
// 사용자를 고칠 수 있는 역할(관리자)에게는 줄마다 수정 링크를 더한다.
const editColumns = columnHelper.columns([
  ...viewColumns,
  columnHelper.display({
    id: 'edit',
    header: () => <span className="sr-only">관리</span>,
    // 줄마다 같은 글자(수정)이므로 누구를 고치는지 이름을 담은 접근 가능한 이름을 붙인다. 보이는 글자를 그대로 담는다.
    cell: ({ row }) => (
      <Link
        href={editUserPath(row.original.id)}
        aria-label={`${row.original.name} 수정`}
        className="focus-ring rounded-sm underline underline-offset-4"
      >
        수정
      </Link>
    ),
  }),
])

const NO_MATCH_MESSAGE = '조건에 맞는 사용자가 없습니다.'

// 데이터를 받기 전에 넘기는 빈 목록. 렌더링할 때마다 새 배열을 넘기면 테이블이 행을 매번 다시 만든다.
const NO_USERS: UserAccount[] = []

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const satisfies Record<SortDirection, string>

/**
 * 사용자 목록 테이블. 정렬하지 않으면 최근에 추가한 사용자부터 보인다. 열 머리글의 버튼으로 정렬하고(오름차순 → 내림차순 →
 * 정렬 없음), 검색어와 역할·상태로 거르고, 페이지를 넘긴다. canEdit이면 줄마다 사용자 수정 링크를 둔다.
 */
export function UserTable({ canEdit = false }: Readonly<{ canEdit?: boolean }>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })
  // 테이블의 상태를 listUsers의 쿼리 파라미터로 바꾼다. 쿼리 키(usersKeys.listUsers)도 이 값으로 정해진다.
  const [sorted] = sorting
  const sort = ListUsersParams.shape.sort.safeParse(sorted?.id).data
  // 역할·상태 열에 건 필터의 값. 걸지 않았으면 undefined다.
  const role = Role.safeParse(columnFilters.find(({ id }) => id === 'role')?.value).data
  const status = UserStatus.safeParse(columnFilters.find(({ id }) => id === 'status')?.value).data
  const q = globalFilter.trim()
  const params: ListUsersParams = {
    ...(q === '' ? {} : { q }),
    ...(role === undefined ? {} : { role }),
    ...(status === undefined ? {} : { status }),
    ...(sort === undefined ? {} : { sort, order: sorted?.desc === true ? 'desc' : 'asc' }),
    // 테이블은 페이지를 0부터, 명세는 1부터 센다.
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  }
  const { data, isError, isPlaceholderData } = useQuery({
    ...listUsersQueryOptions(params),
    // 다음 결과를 받는 동안 지금 결과를 그대로 보여 준다.
    placeholderData: keepPreviousData,
  })

  // 정렬이나 필터가 바뀌면 결과가 달라지므로 그 상태를 바꾸면서 첫 페이지로 돌아간다.
  const andBackToFirstPage =
    <T,>(setState: (updater: Updater<T>) => void) =>
    (updater: Updater<T>) => {
      setState(updater)
      setPagination((current) => ({ ...current, pageIndex: 0 }))
    }
  const columns = canEdit ? editColumns : viewColumns
  const table = useTable({
    features,
    columns,
    data: data?.items ?? NO_USERS,
    rowCount: data?.total ?? 0,
    getRowId: (user) => String(user.id),
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: andBackToFirstPage(setSorting),
    onColumnFiltersChange: andBackToFirstPage(setColumnFilters),
    onGlobalFilterChange: andBackToFirstPage(setGlobalFilter),
    onPaginationChange: setPagination,
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    // 백엔드는 한 열로만 정렬한다. 열마다 오름차순부터 시작한다.
    enableMultiSort: false,
    sortDescFirst: false,
  })

  // 받은 페이지가 거른 사용자 가운데 몇 번째부터 몇 번째까지인지 알린다.
  let summary: string
  if (data === undefined) summary = isError ? '' : '사용자를 불러오는 중입니다.'
  else if (data.total === 0) summary = NO_MATCH_MESSAGE
  else {
    const first = (data.page - 1) * data.pageSize + 1
    summary = `사용자 ${String(data.total)}명 중 ${String(first)}–${String(first + data.items.length - 1)}번째`
  }

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
          value={role ?? ALL}
          className="w-40"
          onValueChange={(value) => {
            table.getColumn('role')?.setFilterValue(Role.safeParse(value).data)
          }}
        />
        <Select
          label="상태"
          options={STATUS_FILTER_OPTIONS}
          value={status ?? ALL}
          className="w-40"
          onValueChange={(value) => {
            table.getColumn('status')?.setFilterValue(UserStatus.safeParse(value).data)
          }}
        />
      </div>
      <p role="status">{summary}</p>
      {isError && <p role="alert">사용자 목록을 불러오지 못했습니다.</p>}
      {data !== undefined && !isError && (
        <>
          <table className="w-full border-collapse text-left" aria-busy={isPlaceholderData}>
            <caption className="mb-2 text-left font-semibold">사용자 목록</caption>
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
                    {NO_MATCH_MESSAGE}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <nav aria-label="사용자 목록 페이지" className="flex items-center gap-2">
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
