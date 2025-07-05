import type { Metadata } from 'next'
import { AuthProvider } from '@/components/providers/auth-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ventry - AI-Native Inventory Management',
  description: 'Modern inventory management system powered by AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}