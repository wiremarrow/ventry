import type { Metadata } from 'next'
import { AuthProvider } from '@/components/providers/auth-provider'
import { TRPCProvider } from '@/components/providers/trpc-provider'
import { OrganizationProvider } from '@/hooks/use-organization'
import { Toaster } from '@ventry/ui'
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
        <TRPCProvider>
          <AuthProvider>
            <OrganizationProvider>
              {children}
              <Toaster />
            </OrganizationProvider>
          </AuthProvider>
        </TRPCProvider>
      </body>
    </html>
  )
}