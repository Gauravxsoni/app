import './globals.css'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Investers Blueprint — Build Your Wealth With Smart Investments',
  description: 'Premium investment platform. Earn daily profit, refer friends, and grow your wealth.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#070b1a] text-white antialiased min-h-screen">
        {children}
        <Toaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  )
}
