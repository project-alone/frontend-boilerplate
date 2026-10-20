# Frontend Boilerplate

팀이 새 프론트엔드 프로젝트를 시작하고, 검증된 패턴을 참고하기 위한 보일러플레이트. 하나의 소스에서 Starter, Showcase, Generator 세 가지 쓰임새를 함께 제공한다.

## Language

### 구성 단위

**Base**:
모든 Starter에 항상 포함되는 최소 앱. 어떤 Recipe나 Archetype도 고르지 않았을 때의 결과물이다.
_Avoid_: core, skeleton, 템플릿

**Recipe**:
하나의 기능 패턴(예: 폼 검증, 무한 스크롤)을 담은, Base에 독립적으로 넣고 뺄 수 있는 단위.
_Avoid_: 케이스, 예제, 모듈, 플러그인

**확장 지점**:
여러 Recipe가 Base의 같은 자리(앱 Provider와 머리글, proxy, `next.config`, instrumentation, OpenAPI 명세, 환경 변수)에 끼어들 때, Base 파일을 고치지 않고 자기 조각만 더하는 곳. Generator가 Base와 Recipe의 조각을 모아 조립한다.
_Avoid_: 훅, 슬롯, 플러그인 포인트

**Rendering Mode**:
페이지를 렌더링하고 배포하는 방식. Starter 전체에는 `server`(서버에서 실행)와 `static-export`(정적 파일만으로 배포) 중 하나를 적용하고, `server` 안에서는 라우트마다 SSR, SSG, ISR, 스트리밍, CSR(페이지 뼈대만 서버가 보내고 데이터는 브라우저가 가져옴) 중에서 고른다.
_Avoid_: 케이스, 렌더링 전략

**Archetype**:
여러 Recipe를 조합해 만든 완성된 앱 유형(예: 관리자 대시보드, 마케팅 랜딩).
_Avoid_: 케이스, 앱 템플릿, 데모

### 코드 구성

**Query Domain**:
백엔드 API의 리소스 묶음 하나에 대해 서버 상태를 조회·변경하고 캐시 정책을 정하는 단위. UI를 갖지 않는다.
_Avoid_: service, api, 모델

**Feature**:
화면을 이루는 UI 조합 단위. 여러 Query Domain을 섞어 쓸 수 있으며 Query Domain과 1:1로 대응하지 않는다.
_Avoid_: 모듈, 위젯, 도메인

### 쓰임새

**Starter**:
Generator가 선택된 Rendering Mode, Recipe, Archetype 조합으로 만들어 낸 새 프로젝트.
_Avoid_: 템플릿, 보일러플레이트, 스캐폴드

**Showcase**:
모든 Recipe와 Archetype을 켠, 실행 가능한 레퍼런스 앱.
_Avoid_: 데모, 플레이그라운드, 예제 앱

**Generator**:
Starter를 만들고, 만들어진 Starter 안에서 Schematic으로 코드를 생성하는 CLI.
_Avoid_: 스캐폴더, create 스크립트, 코드젠

**Schematic**:
Generator가 Starter 안에 만들어 낼 수 있는 코드 한 종류의 틀(예: 쿼리 훅, 폼, 페이지). 생성된 코드는 그 뒤로 프로젝트가 직접 소유한다.
_Avoid_: 템플릿, 스니펫, 블루프린트
