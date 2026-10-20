---
"devc-frontend-generator": minor
---

`chart` Recipe를 더한다. Recharts로 대시보드용 시계열 차트(일별 방문 수)와 비교 차트(판매 채널별 이번 달·지난달 매출)를 그리는 `/charts` 페이지와, 새 차트에도 쓰는 `src/shared/chart`(`ChartFigure`, 디자인 토큰으로 정한 차트 색)를 넣는다. 차트의 색은 디자인 토큰만 써서 `dark-mode`에서도 읽히고, 차트마다 캡션의 요점과 스크린 리더용 데이터 표를 함께 둔다. 데이터는 명세 조각(`stats` tag의 `listDailyVisits`, `listChannelSales`)의 MSW 목을 브라우저가 가져오므로 Rendering Mode `server`와 `static-export`를 모두 지원한다.
