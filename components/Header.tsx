"use client"

import Link from "next/link"
import { ReactNode } from "react"

interface HeaderProps {
  rightContent?: ReactNode
}

export default function Header({ rightContent }: HeaderProps) {
  return (
    <header className="border-b border-border">
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="text-2xl font-serif font-semibold tracking-tight hover:opacity-80 transition-opacity">
          Fortress
        </Link>
        {rightContent && (
          <div className="flex items-center gap-8">
            {rightContent}
          </div>
        )}
      </nav>
    </header>
  )
} 