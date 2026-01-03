"use client"

import * as React from "react"
import { LayoutDashboardIcon, Sparkles } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { useToast } from "@/hooks/use-toast"

import { NavUser } from "@/components/nav-user"
import { DomainSwitcher } from "@/components/domain-switcher"
import { BrandVoiceSidebar } from "@/components/brand-voice-sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

function UpgradeButton() {
  const { toast } = useToast()
  const [plan, setPlan] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [checkoutLoading, setCheckoutLoading] = React.useState(false)

  React.useEffect(() => {
    const loadPlan = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle()
        
        setPlan(profile?.plan || 'free')
      } catch (error) {
        console.error('[UpgradeButton] Error loading plan:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlan()
  }, [])

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        window.location.href = '/sign-up?next=' + encodeURIComponent('/dashboard')
        return
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('[UpgradeButton] Error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout",
        variant: "destructive",
      })
      setCheckoutLoading(false)
    }
  }

  // Only show for free users
  if (loading || plan !== 'free') {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleUpgrade}
          disabled={checkoutLoading}
          className="bg-primary/10 hover:bg-primary/20 group-data-[collapsible=icon]:hidden"
        >
          <Sparkles className="h-4 w-4" />
          <span>Upgrade to Pro</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <span className="text-base font-semibold">Fortress</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Dashboard">
              <Link href="/dashboard">
                <LayoutDashboardIcon className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <DomainSwitcher />
        <BrandVoiceSidebar />
      </SidebarContent>
      <SidebarFooter>
        <UpgradeButton />
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
