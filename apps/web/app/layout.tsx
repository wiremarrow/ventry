import type { Metadata } from 'next'
import { AuthProvider } from '@/components/providers/auth-provider'
import './globals.css'

// Initialize Sentry as early as possible
if (typeof window !== 'undefined') {
  import('@/sentry.client.config');
}

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