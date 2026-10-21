import type { Metadata } from 'next'
import { FileUploader } from '@/features/file-uploader/file-uploader'

export const metadata: Metadata = {
  title: '파일 업로드',
}

// file-upload Recipe: 진행률, 취소, 실패 후 재시도를 갖춘 파일 업로드. 페이지 뼈대는 빌드할 때 미리 만들고, 업로드는 브라우저가
// 보낸다(server는 BFF 프록시, static-export는 백엔드를 직접 부른다). 그래서 두 Rendering Mode에서 같은 코드로 동작한다.
export default function UploadPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">파일 업로드</h1>
      <FileUploader />
    </main>
  )
}
