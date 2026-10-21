---
"devc-frontend-generator": patch
---

Starter의 Vitest(`vitest.setup.ts`)는 목 백엔드 주소(`MOCK_API_BASE_URL`)의 DNS 조회를 운영체제에 묻지 않고 바로 실패시킨다. 보내던 요청을 취소하면 jsdom의 XMLHttpRequest와 Node.js의 fetch가 쓰는 undici가 요청 없이 연결을 새로 열고 MSW가 그 연결을 실제 네트워크로 내보내는데, 그 연결로 보낸 다음 요청이 MSW가 답하는 중에도 DNS 조회가 늦게 실패하면서 네트워크 오류로 끝났다(예: `file-upload`의 업로드를 취소하고 다시 시도하는 테스트가 실패했다). 이제 그 연결은 다음 요청을 받기 전에 끊긴다.
