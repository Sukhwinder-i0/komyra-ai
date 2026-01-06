import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Komyra AI - Interview Platform',
  description: 'AI-powered interview platform for evaluating candidates',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}

