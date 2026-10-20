## 차트

`chart` Recipe로 넣었습니다. [Recharts](https://recharts.github.io/)로 대시보드용 차트를 그리는 패턴입니다. `/charts` 페이지가 샘플 통계로 시계열 차트(일별 방문 수, 선 차트)와 비교 차트(판매 채널별 이번 달·지난달 매출, 막대 차트)를 보여 줍니다.

| 위치                         | 내용                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/shared/chart/`          | 차트마다 쓰는 틀(`chart-figure.tsx`), 디자인 토큰으로 정한 차트 색(`chart-theme.ts`), 명도 대비 계산 |
| `src/features/stats-charts/` | 샘플 차트 두 개와 데이터를 가져오는 `StatsCharts`                                                    |
| `src/queries/stats/`         | `stats` Query Domain(`listDailyVisits`, `listChannelSales`의 queryOptions)                           |
| `src/app/charts/`            | `/charts` 라우트                                                                                     |

- 샘플 통계 API는 `openapi.yaml`의 `stats` tag(`GET /stats/daily-visits`, `GET /stats/channel-sales`)입니다. MSW 목은 명세의 `example`을 돌려줍니다.
- 색은 디자인 토큰만 씁니다. `src/shared/chart/chart-theme.ts`의 `CHART_COLORS`가 계열, 축, 눈금선, 툴팁의 색을 `var(--color-primary)` 같은 토큰으로 정하므로, 토큰 값을 바꾸거나 `dark-mode` Recipe가 어두운 테마의 토큰을 적용하면 차트도 따라 바뀝니다. 차트에만 쓰는 색(브랜드의 차트 팔레트 등)이 필요하면 `tokens.css`에 `--color-chart-1` 같은 토큰을 더하고(`dark-mode`를 쓰면 `tokens-dark.css`에도 어두운 값을 더합니다) `CHART_COLORS`를 그 토큰으로 바꿉니다. 계열의 선과 막대는 배경과 3:1, 축 글자는 4.5:1 이상의 명도 대비를 지켜야 합니다(아래 테스트가 잽니다).
- 차트마다 스크린 리더용 텍스트 대안이 있습니다. 새 차트도 `ChartFigure`로 감쌉니다. `ChartFigure`는 제목과 요점(예: 최고·최저, 합계)을 캡션으로 보여 주고, 차트 그림(SVG)은 보조 기술에서 숨긴 뒤(`aria-hidden`) 같은 값을 화면에는 보이지 않는 데이터 표(`sr-only`)로 함께 둡니다. 그래서 그림 안에 포커스를 받는 요소가 없도록 Recharts의 `accessibilityLayer`를 끕니다. 표를 화면에도 보이게 하려면 `chart-figure.tsx`에서 표의 `sr-only`를 지우거나 `<details>`로 감쌉니다.
- 차트는 브라우저에서 그리므로 데이터도 브라우저가 가져옵니다(`useQuery`, CSR). 서버가 보낸 HTML에는 불러오는 중 상태가 담기고, Rendering Mode `server`와 `static-export`에서 같은 코드로 동작합니다. 차트마다 따로 가져오므로 한 API가 실패해도 다른 차트는 보입니다.
- Recharts는 `react-is`를 peer dependency로 씁니다. `react`를 올릴 때 `react-is`도 같은 버전으로 올립니다.
- 샘플을 지우려면 `src/app/charts/`, `src/features/stats-charts/`, `src/queries/stats/`, `e2e/chart.spec.ts`와 `openapi.yaml`의 `stats` tag·경로·스키마(`DailyVisits`, `ChannelSales`)를 지우고 `npm run api:gen`을 실행합니다. 새 차트에 쓸 `src/shared/chart/`는 남겨 둡니다.
- 테스트: `src/features/stats-charts/stats-charts.test.tsx`(두 차트의 데이터 표·캡션, 불러오는 중·실패 상태), `src/shared/chart/chart-contrast.test.ts`(명도 대비 계산), `daily-visits-chart.stories.tsx`·`channel-sales-chart.stories.tsx`(axe 검사, 그림을 숨기고 표를 둠, 선·막대·축 글자의 명도 대비. `dark-mode`가 있으면 다크 모드 브라우저에서도 실행), `e2e/chart.spec.ts`(빌드한 앱에서 두 차트와 데이터 표, 운영체제가 라이트·다크 모드일 때의 명도 대비와 axe 검사).
