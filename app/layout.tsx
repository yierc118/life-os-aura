import type React from "react"
import type { Metadata } from "next"
import { Quicksand } from "next/font/google"
import "./globals.css"

const quicksand = Quicksand({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-quicksand",
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Aura - Yier's Life OS",
  description: "Your personal AI assistant with Monument Valley aesthetics",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${quicksand.variable} antialiased`}>
      <head>
        <style>{`
html {
  font-family: ${quicksand.style.fontFamily};
  --font-sans: var(--font-quicksand);
  --font-display: var(--font-quicksand);
}
        `}</style>
      </head>
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  )
}
