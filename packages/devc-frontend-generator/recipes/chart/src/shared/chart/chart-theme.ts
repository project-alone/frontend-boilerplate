import type { CSSProperties } from 'react'

/**
 * 차트의 색(chart Recipe). 디자인 토큰(src/shared/ui/tokens.css)의 CSS 변수를 그대로 쓰므로, 다크 모드처럼 토큰 값만
 * 바꾸는 테마를 차트도 따라간다. Recharts는 이 값을 SVG의 stroke·fill과 툴팁의 style에 넣는다.
 *
 * - 계열 색은 명도 대비 3:1(WCAG 1.4.11) 이상이어야 배경 위에서 읽힌다. 지금 토큰 값은 라이트·다크 테마 모두 기준을 넘는다.
 * - 계열끼리는 색만으로 구별하지 않는다(WCAG 1.4.1). 지금 두 계열 색은 서로 3:1이 안 되므로, 함께 그릴 때는 모양으로도
 *   나눈다(예: 비교하는 계열은 테두리만 그린 막대나 점선).
 * - 차트에만 쓰는 색(브랜드의 차트 팔레트 등)이 필요하면 tokens.css에 `--color-chart-1` 같은 토큰을 더하고
 *   (dark-mode Recipe를 쓰면 tokens-dark.css에도 어두운 값을 더한다) 아래 값을 그 토큰으로 바꾼다.
 */
export const CHART_COLORS = {
  /** 주요 계열(예: 이번 달) */
  primarySeries: 'var(--color-primary)',
  /** 비교하는 계열(예: 지난달) */
  secondarySeries: 'var(--color-muted-foreground)',
  /** 축과 눈금 글자 */
  axis: 'var(--color-muted-foreground)',
  /** 눈금선 */
  grid: 'var(--color-border)',
  /** 차트 배경. 점의 안쪽, 테두리만 그린 막대의 안쪽처럼 배경으로 비워 보일 곳에 쓴다. */
  surface: 'var(--color-background)',
  /** 마우스를 올린 막대 뒤의 강조 */
  highlight: 'var(--color-muted)',
} as const

/**
 * 차트(LineChart, BarChart 등)마다 쓰는 속성. ChartFigure가 정한 높이를 채우고(responsive), 그림을 보조 기술에서 숨기므로
 * 그림 안에 포커스를 받는 요소를 두지 않는다(accessibilityLayer를 끈다. ChartFigure 참고).
 */
export const CHART_PROPS = {
  responsive: true,
  accessibilityLayer: false,
  style: { width: '100%', height: '100%' },
  margin: { top: 8, right: 16, bottom: 0, left: 0 },
} as const

/** 값을 읽기 위한 가로 눈금선. 데이터보다 눈에 덜 띄게 점선으로 그린다. */
export const CHART_GRID_PROPS = { vertical: false, stroke: CHART_COLORS.grid, strokeDasharray: '3 3' } as const

/** 차트 툴팁의 모양. Recharts 기본 툴팁의 흰 배경과 계열 색 글자 대신 토큰의 배경·글자·테두리를 쓴다. */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'var(--color-background)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-foreground)',
    fontSize: 'var(--text-sm)',
  },
  labelStyle: { color: 'var(--color-foreground)', fontWeight: 'var(--font-weight-semibold)' },
  itemStyle: { color: 'var(--color-foreground)' },
} satisfies Record<string, CSSProperties>
