import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { UPLOAD_MAX_BYTES } from '@/shared/upload/upload-policy'

// file-upload Recipe: 빌드한 앱의 /upload에서 파일을 올린다. 업로드는 브라우저가 XMLHttpRequest로 보내고(server는 BFF 프록시,
// static-export는 백엔드 주소로 직접), MSW의 업로드 핸들러(src/shared/mocks/files.ts)가 파일 이름으로 응답을 고른다.
// 이름에 slow가 들면 늦게 답하고, flaky가 들면 그 이름으로 처음 올릴 때 실패한다. 서버를 다시 쓰는 로컬 실행에서도 처음 올리는
// 이름이 되도록 이름에 실행마다 다른 값을 붙인다.

const RUN = `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`

/** 올릴 파일. size만큼 같은 글자로 채운다. */
function textFile(name: string, size = 1024) {
  return { name, mimeType: 'text/plain', buffer: Buffer.alloc(size, 'a') }
}

/** 업로드 목록에서 파일 하나의 항목 */
function uploadItem(page: Page, name: string): Locator {
  return page.getByRole('list', { name: '업로드 목록' }).getByRole('listitem').filter({ hasText: name })
}

/**
 * /upload를 열고 업로드를 보낼 수 있을 때까지 기다린다. static-export에서는 브라우저의 MSW(서비스 워커)가 요청을 받는데, 업로드는
 * XMLHttpRequest로 보내므로 서비스 워커가 준비되기 전에 보내면 MSW가 받지 못한다. fetch는 서비스 워커가 준비될 때까지 붙잡아
 * 두므로(src/shared/mocks/browser-instrumentation.ts) fetch 하나가 끝나기를 기다린다. 브라우저의 MSW가 없는 server에서는 바로 끝난다.
 */
async function openUploader(page: Page) {
  await page.goto('/upload')
  await expect(page.getByRole('heading', { level: 1, name: '파일 업로드' })).toBeVisible()
  await page.evaluate(async () => {
    await fetch(window.location.href, { method: 'HEAD' })
  })
}

/** 파일 선택 버튼으로 파일 고르기 창을 열어 files를 고른다. */
async function pickFiles(page: Page, files: ReturnType<typeof textFile>[]) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '파일 선택' }).click()
  await (await chooser).setFiles(files)
}

/** 놓는 곳(안내 문구)에 파일을 끌어 놓는다. */
async function dropFiles(page: Page, files: { name: string; type: string; size: number }[]) {
  const dataTransfer = await page.evaluateHandle((dropped) => {
    const transfer = new DataTransfer()
    for (const { name, type, size } of dropped) transfer.items.add(new File([new Uint8Array(size)], name, { type }))
    return transfer
  }, files)
  await page.getByText(/파일을 여기에 끌어 놓거나/).dispatchEvent('drop', { dataTransfer })
}

/** 업로더의 알림 영역(role="status")에 덧붙은 알림 하나. 알림 영역은 화면에는 보이지 않는다(sr-only). */
function announcement(page: Page, text: string): Locator {
  return page.getByRole('status').getByText(text, { exact: true })
}

/** 업로드(POST /files) 요청을 모은다. */
function recordUploads(page: Page): string[] {
  const uploads: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/files')) uploads.push(request.url())
  })
  return uploads
}

/** Tab 키만 눌러 target까지 포커스를 옮긴다. 다른 Recipe가 머리글에 더한 요소가 있어도 된다. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 30; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

/** 페이지의 진행 막대 값(aria-valuenow)이 바뀔 때마다 모은다. 값은 recordedProgress로 읽는다. */
async function recordProgress(page: Page) {
  await page.evaluate(() => {
    const values: number[] = []
    Object.assign(window, { recordedProgress: values })
    new MutationObserver(() => {
      const value = document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')
      if (value != null && values.at(-1) !== Number(value)) values.push(Number(value))
    }).observe(document.body, { subtree: true, childList: true, attributes: true })
  })
}

test('키보드로 연 파일 고르기 창에서 고른 파일을 진행률을 보여 주며 올리고, 다 올리면 알린다', async ({ page }) => {
  await openUploader(page)
  // 업로드 속도를 늦춰 본문을 보내는 동안의 진행률이 드러나게 한다(Chromium의 네트워크 흉내).
  const devtools = await page.context().newCDPSession(page)
  await devtools.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: 512 * 1024,
  })
  await recordProgress(page)
  const name = `slow-report-${RUN}.txt`

  await tabTo(page, page.getByRole('button', { name: '파일 선택' }))
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles(textFile(name, 1024 * 1024))

  const item = uploadItem(page, name)
  const progress = item.getByRole('progressbar', { name: `${name} 업로드 진행률` })
  await expect(progress).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuetext', /^\d+%$/)
  await expect(item.getByText(/올리는 중입니다\.|서버가 파일을 받는 중입니다\./)).toBeVisible()
  await expect(item.getByText('올렸습니다.')).toBeVisible({ timeout: 15_000 })
  await expect(progress).toBeHidden()

  const values = await page.evaluate(() => (window as unknown as { recordedProgress: number[] }).recordedProgress)
  expect(values[0]).toBe(0)
  expect(values).toEqual([...values].sort((a, b) => a - b))
  // 업로드가 네트워크를 지날 때(server의 BFF 프록시)는 보내는 동안의 값이 보인다. static-export의 E2E에서는 브라우저의
  // MSW(서비스 워커)가 본문을 네트워크로 보내지 않고 받으므로 진행률이 중간값 없이 끝난다.
  const viaNetwork = await page.evaluate(() => navigator.serviceWorker.controller === null)
  if (viaNetwork) expect(values.some((value) => value > 0 && value < 100)).toBe(true)
})

test('끌어 놓은 파일도 올리고, 여러 파일은 파일마다 따로 올린다', async ({ page }) => {
  await openUploader(page)

  await dropFiles(page, [
    { name: 'photo.png', type: 'image/png', size: 2048 },
    { name: 'manual.pdf', type: 'application/pdf', size: 4096 },
  ])

  await expect(uploadItem(page, 'photo.png').getByText('올렸습니다.')).toBeVisible()
  await expect(uploadItem(page, 'manual.pdf').getByText('올렸습니다.')).toBeVisible()
})

test('명세가 받지 않는 크기·형식의 파일은 요청을 보내지 않고 이유를 알린다', async ({ page }) => {
  const uploads = recordUploads(page)
  await openUploader(page)

  await dropFiles(page, [
    { name: 'huge.png', type: 'image/png', size: UPLOAD_MAX_BYTES + 1 },
    { name: 'setup.exe', type: 'application/x-msdownload', size: 2 },
  ])

  const tooLarge = '올릴 수 없는 파일입니다. 5MB 이하의 파일만 올릴 수 있습니다.'
  const unsupported = '올릴 수 없는 파일입니다. PNG, JPEG, PDF, 텍스트 파일만 올릴 수 있습니다.'
  await expect(uploadItem(page, 'huge.png').getByText(tooLarge)).toBeVisible()
  await expect(uploadItem(page, 'setup.exe').getByText(unsupported)).toBeVisible()
  // 거절한 이유는 처음부터 있던 알림 영역이 보조 기술에 읽어 준다.
  await expect(announcement(page, `huge.png: ${tooLarge}`)).toBeAttached()
  await expect(announcement(page, `setup.exe: ${unsupported}`)).toBeAttached()
  expect(uploads).toEqual([])
})

test('올리는 중에 취소하면 업로드를 멈추고, 다시 시도하면 처음부터 올린다', async ({ page }) => {
  const uploads = recordUploads(page)
  await openUploader(page)
  const name = `slow-draft-${RUN}.txt`
  await pickFiles(page, [textFile(name)])
  const item = uploadItem(page, name)
  await expect(item.getByRole('progressbar')).toBeVisible()

  await item.getByRole('button', { name: `${name} 업로드 취소` }).click()

  await expect(item.getByText('업로드를 취소했습니다.')).toBeVisible()
  await expect(item.getByRole('progressbar')).toBeHidden()
  const retry = item.getByRole('button', { name: `${name} 다시 시도` })
  await expect(retry).toBeFocused()

  await page.keyboard.press('Enter')

  await expect(item.getByRole('progressbar')).toBeVisible()
  await expect(item.getByText('올렸습니다.')).toBeVisible({ timeout: 15_000 })
  expect(uploads).toHaveLength(2)
})

test('백엔드가 거절하면 알려 준 이유를 보여 주고, 다시 시도해 올린다', async ({ page }) => {
  await openUploader(page)
  const name = `flaky-invoice-${RUN}.txt`

  await pickFiles(page, [textFile(name)])

  const item = uploadItem(page, name)
  const failure = '올리지 못했습니다. 일시적인 오류로 파일을 받지 못했습니다.'
  await expect(item.getByText(failure)).toBeVisible()
  await expect(announcement(page, `${name}: ${failure}`)).toBeAttached()
  await item.getByRole('button', { name: `${name} 다시 시도` }).click()
  await expect(item.getByText('올렸습니다.')).toBeVisible()
  await expect(announcement(page, `${name}: 올렸습니다.`)).toBeAttached()
})

// 운영체제가 다크 모드이면 다크 테마를 더하는 Recipe(dark-mode)와 함께 켠 Starter는 다크 테마로 연다. 그런 Recipe가 없으면
// 두 경우 모두 Base의 테마다.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`운영체제가 ${colorScheme === 'light' ? '라이트' : '다크'} 모드이면`, () => {
    test.use({ colorScheme })

    test('업로드 페이지에 WCAG 2.2 AA 접근성 위반이 없다(올림, 실패, 거절, 올리는 중인 항목 포함)', async ({
      page,
    }) => {
      await openUploader(page)
      await dropFiles(page, [{ name: 'huge.png', type: 'image/png', size: UPLOAD_MAX_BYTES + 1 }])
      await pickFiles(page, [textFile('notes.txt'), textFile(`flaky-${colorScheme}-${RUN}.txt`)])
      await expect(uploadItem(page, 'notes.txt').getByText('올렸습니다.')).toBeVisible()
      await expect(uploadItem(page, `flaky-${colorScheme}-${RUN}.txt`).getByText(/올리지 못했습니다/)).toBeVisible()
      await pickFiles(page, [textFile(`slow-${colorScheme}-${RUN}.txt`)])
      await expect(page.getByRole('progressbar')).toBeVisible()

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
      expect(violations).toEqual([])
    })
  })
}
