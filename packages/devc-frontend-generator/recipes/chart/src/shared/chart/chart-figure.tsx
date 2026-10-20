import { useId, type ReactNode } from 'react'

/** 데이터 표의 열 하나. 첫 열은 행의 제목(예: 날짜, 채널)이다. */
export interface ChartTableColumn<Row> {
  header: string
  cell: (row: Row) => string
}

export interface ChartFigureProps<Row> {
  /** 차트의 제목. 그림의 캡션이자 데이터 표의 이름이다. */
  title: string
  /** 차트에서 읽어 낼 요점(예: 최고·최저, 합계). 모든 사용자에게 보인다. */
  summary: string
  /** 차트가 그리는 값. 스크린 리더용 데이터 표의 행이 된다. */
  rows: readonly Row[]
  columns: readonly [ChartTableColumn<Row>, ...ChartTableColumn<Row>[]]
  rowKey: (row: Row) => string
  /** Recharts 차트. 높이가 정해진 상자 안에 그려지므로 차트는 width·height 100%로 채운다(responsive). */
  children: ReactNode
}

/**
 * 차트 하나와 그 텍스트 대안을 묶는다(chart Recipe).
 *
 * - 차트 그림(SVG)은 보조 기술에서 숨긴다(aria-hidden). 선과 막대는 스크린 리더가 읽을 수 없으므로, 같은 값을 화면에는
 *   보이지 않는 데이터 표(sr-only)로 함께 둔다. 그래서 그림 안에는 포커스를 받는 요소를 두지 않는다(Recharts의
 *   accessibilityLayer를 끈다).
 * - 제목과 요점은 그림의 캡션(figcaption)으로 모든 사용자에게 보인다. 제목은 그림의 이름, 요점은 설명이 된다.
 * - 표를 화면에도 보이게 하려면 sr-only를 지우거나 <details>로 감싼다.
 */
export function ChartFigure<Row>({ title, summary, rows, columns, rowKey, children }: ChartFigureProps<Row>) {
  const [rowHeader, ...valueColumns] = columns
  const titleId = useId()
  const summaryId = useId()

  return (
    <figure aria-labelledby={titleId} aria-describedby={summaryId} className="flex flex-col gap-2">
      <figcaption className="flex flex-col gap-1">
        <span id={titleId} className="font-semibold">
          {title}
        </span>
        <span id={summaryId} className="text-sm text-muted-foreground">
          {summary}
        </span>
      </figcaption>
      <div aria-hidden="true" className="h-64 w-full text-sm">
        {children}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              <th scope="row">{rowHeader.cell(row)}</th>
              {valueColumns.map((column) => (
                <td key={column.header}>{column.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
