import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import sirv from 'sirv'

// Rendering Mode static-export의 `npm run start`. 빌드 결과(out/)를 정적 파일 서버로 띄운다(E2E도 이 서버를 쓴다).
// 정적 파일을 서빙하는 호스팅처럼, 없는 주소에는 빌드가 앱 수준의 404 화면(src/app/not-found.tsx)으로 만든 out/404.html을
// 상태 코드 404로 보낸다. 배포할 호스팅에도 같은 설정을 한다(README의 "실행과 배포").
const OUT_DIR = 'out'

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: '8080' },
    host: { type: 'string', short: 'H', default: 'localhost' },
  },
})

const notFoundPage = readFileSync(join(OUT_DIR, '404.html'))
const serveOut = sirv(OUT_DIR, {
  onNoMatch: (_request, response) => {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(notFoundPage)
  },
})

createServer(serveOut).listen(Number(values.port), values.host, () => {
  console.log(`${OUT_DIR}/을 http://${values.host}:${values.port} 에서 보냅니다.`)
})
