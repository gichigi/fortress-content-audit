"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase-browser"

export function SiteHeader() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
    }
    checkAuth()

    // Listen for auth changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center gap-1 lg:gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <Link href="/dashboard" className="text-2xl font-serif font-semibold tracking-tight hover:opacity-80 transition-opacity">
            Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated ? null : (
            <>
              <Button variant="ghost" onClick={() => router.push('/sign-up?mode=sign-in')}>Sign In</Button>
              <Button onClick={() => router.push('/sign-up?mode=sign-up')}>Sign Up</Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
