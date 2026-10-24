// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/shared/seo/og-image.tsx

import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { SITE_NAME } from './site'

// seo Recipe: 공유 카드(Open Graph, Twitter)에 보이는 이미지. 라우트 폴더의 opengraph-image.tsx가 이 함수로 그린다.

// 공유 카드 이미지의 권장 크기
const OG_IMAGE_SIZE = { width: 1200, height: 630 }

/**
 * opengraph-image.tsx의 generateImageMetadata로 쓴다. 이미지를 `opengraph-image/image.png`처럼 확장자가 붙은 주소 하나로
 * 만든다. 확장자가 없으면 Rendering Mode static-export가 내보낸 파일(out/opengraph-image)을 정적 파일 서버가 이미지로
 * 알리지 못한다(Content-Type이 비거나 application/octet-stream). alt는 이미지를 설명하는 글이다(og:image:alt).
 */
export function ogImageMetadata(alt: string) {
  return [{ id: 'image.png', alt, size: OG_IMAGE_SIZE, contentType: 'image/png' }]
}

export interface OgImageContent {
  /** 크게 보일 제목. 보통 페이지의 title이다. */
  title: string
  /** 제목 아래의 설명. 두 줄이 넘으면 줄임표로 자른다. */
  description?: string
}

/**
 * 사이트 이름, 제목, 설명을 담은 공유 카드 이미지를 그린다. opengraph-image.tsx는 빌드할 때 이 함수를 불러 PNG를 만든다.
 *
 * - 글꼴은 함께 넣은 Pretendard Bold(한글 11,172자, SIL Open Font License, pretendard-license.txt)다. next/og는 글꼴에 없는
 *   글자(한글 등)를 만나면 빌드 중에 Google Fonts에서 글꼴을 받으려 하므로, 네트워크가 막힌 CI에서도 같은 이미지가 나오도록
 *   글꼴을 함께 둔다. 한자, 일본어, 이모지처럼 이 글꼴에 없는 글자는 여전히 받으러 가니 제목에 쓰지 않는다.
 * - next/og는 CSS 변수를 읽지 못하므로 색은 디자인 토큰 파일(src/shared/ui/tokens.css)의 값을 읽어 쓴다. 토큰 값은 hex,
 *   rgb(), hsl() 같은 next/og가 아는 색 형식이어야 한다. 글자 크기와 간격은 화면이 아니라 1200×630 이미지에 맞춘 픽셀
 *   값이고 테마가 바꿀 일이 없으므로 토큰을 쓰지 않는다.
 */
export async function ogImage({ title, description }: OgImageContent): Promise<ImageResponse> {
  // sitemap(src/app/sitemap.ts)과 달리 이 두 파일은 번들러가 따라가게 둔다. server Starter의 빌드 결과(standalone)에
  // 함께 담겨, 빌드할 때 만들지 않은 이미지 주소로 요청이 와도 서버가 이미지를 그릴 수 있다.
  const [font, tokens] = await Promise.all([
    readFile(join(process.cwd(), 'src/shared/seo/pretendard-bold.woff')),
    readFile(join(process.cwd(), 'src/shared/ui/tokens.css'), 'utf8'),
  ])
  const color = (name: string) => colorToken(tokens, name)

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: 80,
        background: color('background'),
        color: color('foreground'),
        fontFamily: 'Pretendard',
      }}
    >
      <div style={{ display: 'flex', fontSize: 32, color: color('muted-foreground') }}>{SITE_NAME}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'block', fontSize: 72, lineHeight: 1.25, lineClamp: 3, wordBreak: 'keep-all' }}>
          {title}
        </div>
        {description === undefined ? null : (
          <div
            style={{
              display: 'block',
              fontSize: 32,
              lineHeight: 1.5,
              lineClamp: 2,
              wordBreak: 'keep-all',
              color: color('muted-foreground'),
            }}
          >
            {description}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', width: 120, height: 8, background: color('primary') }} />
    </div>,
    { ...OG_IMAGE_SIZE, fonts: [{ name: 'Pretendard', data: font, weight: 700, style: 'normal' }] },
  )
}

// tokens.css에서 `--color-<name>: <값>;`의 값을 찾는다.
function colorToken(tokens: string, name: string): string {
  const value = new RegExp(`(?<![\\w-])--color-${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim()
  if (value === undefined) throw new Error(`src/shared/ui/tokens.css에 --color-${name} 토큰이 없습니다.`)
  return value
}
