"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase-browser"

export function SiteHeader() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [plan, setPlan] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      
      // Load plan if authenticated
      if (session) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('user_id', session.user.id)
            .maybeSingle()
          
          setPlan(profile?.plan || 'free')
        } catch (error) {
          console.error('[SiteHeader] Error loading plan:', error)
        }
      } else {
        setPlan(null)
      }
    }
    checkAuth()

    // Listen for auth changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth()
    })

    // Listen for payment success to refresh plan
    const handlePaymentSuccess = () => {
      checkAuth()
    }
    window.addEventListener('paymentSuccess', handlePaymentSuccess)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('paymentSuccess', handlePaymentSuccess)
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
          {isAuthenticated && plan && (
            <Badge 
              variant={plan === 'pro' || plan === 'enterprise' ? 'default' : 'secondary'}
              className="ml-2"
            >
              {plan === 'enterprise' ? 'Tier 3' : plan === 'pro' ? 'Tier 2' : 'Tier 1'}
            </Badge>
          )}
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
