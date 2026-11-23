import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'فروشگاه پلاسکو | حسابداری',
  description: 'سامانه حسابداری فروشگاه لوازم پلاسکو خانه',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'حسابداری پلاسکو' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1b6b54',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preload" href="/fonts/AbarMid-Regular.woff" as="font" type="font/woff" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
