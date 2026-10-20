import Link from 'next/link'

export default function ExtensionFixturePage() {
  return (
    <main>
      <h1>확장 지점 시험</h1>
      <p data-testid="next-config">{process.env.FIXTURE_NEXT_CONFIG}</p>
      <Link href="/">홈</Link>
    </main>
  )
}
