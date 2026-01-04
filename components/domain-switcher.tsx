"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase-browser"
import { Globe, Check, Plus, Trash2, MoreHorizontalIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NewAuditDialog } from "@/components/new-audit-dialog"

export function DomainSwitcher() {
  const [domains, setDomains] = React.useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [newAuditDialogOpen, setNewAuditDialogOpen] = React.useState(false)
  const [plan, setPlan] = React.useState<string>("free")
  const [usageInfo, setUsageInfo] = React.useState<any>(null)
  const { isMobile } = useSidebar()

  const handleDeleteDomain = (domain: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent domain selection when clicking delete
    // Dispatch event to dashboard to show delete confirmation
    window.dispatchEvent(new CustomEvent('requestDeleteDomain', { detail: { domain } }))
  }

  React.useEffect(() => {
    const loadDomains = async () => {
      try {
        const supabase = createClient()
        const { data: { user, session } } = await supabase.auth.getUser()
        if (!user) return

        // Load plan
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle()
        
        if (profile) {
          setPlan(profile.plan || 'free')
        }

        // Load usage info
        if (session) {
          try {
            const response = await fetch('/api/audit/usage', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            })
            if (response.ok) {
              const data = await response.json()
              setUsageInfo(data)
            }
          } catch (error) {
            console.error("Error loading usage info:", error)
          }
        }

        const { data: audits } = await supabase
          .from('brand_audit_runs')
          .select('domain')
          .eq('user_id', user.id)
          .not('domain', 'is', null)

        if (audits) {
          const uniqueDomains = Array.from(new Set(
            audits.map(a => a.domain).filter((d): d is string => d !== null)
          ))
          setDomains(uniqueDomains)
          
          // Get selected domain from localStorage
          const savedDomain = localStorage.getItem('selectedDomain')
          const initialDomain = savedDomain || uniqueDomains[0] || null
          setSelectedDomain(initialDomain)
        }
      } catch (error) {
        console.error("Error loading domains:", error)
      } finally {
        setLoading(false)
      }
    }

    loadDomains()

    // Listen for custom events
    const handleCustomStorageChange = () => {
      const domain = localStorage.getItem('selectedDomain')
      setSelectedDomain(domain)
    }
    
    // Listen for domain deletion/reload events
    const handleDomainsReload = async () => {
      console.log('[DomainSwitcher] Reloading domains after deletion')
      const supabase = createClient()
      const { data: { user, session } } = await supabase.auth.getUser()
      if (!user) return

      // Reload usage info
      if (session) {
        try {
          const response = await fetch('/api/audit/usage', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
          if (response.ok) {
            const data = await response.json()
            setUsageInfo(data)
          }
        } catch (error) {
          console.error("Error loading usage info:", error)
        }
      }

      const { data: audits } = await supabase
        .from('brand_audit_runs')
        .select('domain')
        .eq('user_id', user.id)
        .not('domain', 'is', null)

      if (audits) {
        const uniqueDomains = Array.from(new Set(
          audits.map(a => a.domain).filter((d): d is string => d !== null)
        ))
        setDomains(uniqueDomains)
        
        // Update selected domain if it was deleted
        const savedDomain = localStorage.getItem('selectedDomain')
        if (savedDomain && !uniqueDomains.includes(savedDomain)) {
          // Selected domain was deleted, switch to first available or clear
          const newDomain = uniqueDomains[0] || null
          setSelectedDomain(newDomain)
          if (newDomain) {
            localStorage.setItem('selectedDomain', newDomain)
            window.dispatchEvent(new Event('domainChanged'))
          } else {
            localStorage.removeItem('selectedDomain')
          }
        }
      } else {
        // No domains left
        setDomains([])
        setSelectedDomain(null)
        localStorage.removeItem('selectedDomain')
      }
    }
    
    window.addEventListener('domainChanged', handleCustomStorageChange)
    window.addEventListener('domainsReload', handleDomainsReload)

    return () => {
      window.removeEventListener('domainChanged', handleCustomStorageChange)
      window.removeEventListener('domainsReload', handleDomainsReload)
    }
  }, [])

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain)
    localStorage.setItem('selectedDomain', domain)
    // Dispatch custom event for same-window updates
    window.dispatchEvent(new Event('domainChanged'))
  }

  const handleNewAuditSuccess = (newDomain: string) => {
    // Domain is only passed here if audit completed successfully
    // Normalize domain (remove protocol, www, trailing slash)
    const normalizedDomain = newDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
    
    // Add to sidebar (audit already completed successfully)
    if (normalizedDomain && !domains.includes(normalizedDomain)) {
      setDomains(prev => [...prev, normalizedDomain])
      setSelectedDomain(normalizedDomain)
      localStorage.setItem('selectedDomain', normalizedDomain)
      window.dispatchEvent(new Event('domainChanged'))
    }

    // Reload from server to ensure consistency and update usage info
    const loadDomains = async () => {
      try {
        const supabase = createClient()
        const { data: { user, session } } = await supabase.auth.getUser()
        if (!user) return

        // Reload usage info
        if (session) {
          try {
            const response = await fetch('/api/audit/usage', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            })
            if (response.ok) {
              const data = await response.json()
              setUsageInfo(data)
            }
          } catch (error) {
            console.error("Error loading usage info:", error)
          }
        }

        const { data: audits } = await supabase
          .from('brand_audit_runs')
          .select('domain')
          .eq('user_id', user.id)
          .not('domain', 'is', null)

        if (audits) {
          const uniqueDomains = Array.from(new Set(
            audits.map(a => a.domain).filter((d): d is string => d !== null)
          ))
          setDomains(uniqueDomains)
          
          // Ensure new domain is still selected after reload
          if (uniqueDomains.includes(normalizedDomain)) {
            setSelectedDomain(normalizedDomain)
            localStorage.setItem('selectedDomain', normalizedDomain)
            window.dispatchEvent(new Event('domainChanged'))
          }
        }
      } catch (error) {
        console.error("Error loading domains:", error)
      }
    }
    loadDomains()
  }

  // Check if free user has reached domain limit
  const isAtDomainLimit = plan === 'free' && usageInfo && usageInfo.domainLimit > 0 && usageInfo.domains >= usageInfo.domainLimit
  const isNewDomainDisabled = plan === 'free' && isAtDomainLimit

  if (loading) {
    return null
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Domains</SidebarGroupLabel>
      <SidebarMenu>
        {domains.map((domain) => (
          <SidebarMenuItem key={domain}>
            <SidebarMenuButton
              onClick={() => handleDomainChange(domain)}
              data-active={selectedDomain === domain}
              tooltip={domain}
            >
              <Globe className="h-4 w-4" />
              <span>{domain}</span>
              {selectedDomain === domain && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="rounded-sm data-[state=open]:bg-accent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontalIcon />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-32 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem
                  onClick={(e) => handleDeleteDomain(domain, e)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setNewAuditDialogOpen(true)}
            tooltip={isNewDomainDisabled ? "Domain limit reached. Upgrade to Pro for 5 domains." : "New Domain"}
            disabled={isNewDomainDisabled}
          >
            <Plus className="h-4 w-4" />
            <span>New Domain</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <NewAuditDialog
        open={newAuditDialogOpen}
        onOpenChange={setNewAuditDialogOpen}
        onSuccess={handleNewAuditSuccess}
      />
    </SidebarGroup>
  )
}

