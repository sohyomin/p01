import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '버스 룰렛 | 청주 상당구',
  description: '오늘 하루 다녀올 수 있는 청주 시내버스 노선을 무작위로 추천해드립니다.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
