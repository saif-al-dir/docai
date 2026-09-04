import './globals.css'

export const metadata = {
  title: 'DocAI',
  description: 'Chat with your documents — RAG with citations',
  icons: {
    icon: '/favicon.svg',
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  )
}