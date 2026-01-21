"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase-browser"
import { Globe, Check, Plus, Trash2, MoreHorizontalIcon, Loader2 } from "lucide-react"
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
import { DomainLimitReachedModal } from "@/components/domain-limit-reached-modal"
import { useCheckDomainLimit } from "@/hooks/use-check-domain-limit"

export function DomainSwitcher() {
  const [domains, setDomains] = React.useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [newAuditDialogOpen, setNewAuditDialogOpen] = React.useState(false)
  const [domainLimitModalOpen, setDomainLimitModalOpen] = React.useState(false)
  const [checkingLimit, setCheckingLimit] = React.useState(false)
  const [plan, setPlan] = React.useState<string>("free")
  const [usageInfo, setUsageInfo] = React.useState<any>(null)
  const { isMobile } = useSidebar()
  const { isAtLimit, plan: limitPlan, currentDomains, domainLimit, checkLimit } = useCheckDomainLimit()

  const handleDeleteDomain = (domain: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent domain selection when clicking delete
    // Dispatch event to dashboard to show delete confirmation
    window.dispatchEvent(new CustomEvent('requestDeleteDomain', { detail: { domain } }))
  }

  const handleNewDomainClick = async () => {
    setCheckingLimit(true)
    const result = await checkLimit()
    setCheckingLimit(false)

    if (result.isAtLimit) {
      setDomainLimitModalOpen(true)
    } else {
      setNewAuditDialogOpen(true)
    }
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
          // Normalize and deduplicate domains
          const normalizedDomains = audits
            .map(a => a.domain)
            .filter((d): d is string => d !== null)
            .map(d => d.toLowerCase().trim())
          const uniqueDomains = Array.from(new Set(normalizedDomains))
          setDomains(uniqueDomains)
          
          // Get selected domain from localStorage (normalize for comparison)
          const savedDomain = localStorage.getItem('selectedDomain')
          const normalizedSavedDomain = savedDomain ? savedDomain.toLowerCase().trim() : null
          const initialDomain = (normalizedSavedDomain && uniqueDomains.includes(normalizedSavedDomain)) 
            ? normalizedSavedDomain 
            : uniqueDomains[0] || null
          setSelectedDomain(initialDomain)
        }
      } catch (error) {
        console.error("Error loading domains:", error)
      } finally {
        setLoading(false)
      }
    }

    loadDomains()

    // Listen for payment success to refresh plan
    const handlePaymentSuccess = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (profile) {
        setPlan(profile.plan || 'free')
      }
      
      // Reload usage info to get updated domain limits
      const { data: { session } } = await supabase.auth.getSession()
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
    }

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
        // Normalize and deduplicate domains
        const normalizedDomains = audits
          .map(a => a.domain)
          .filter((d): d is string => d !== null)
          .map(d => d.toLowerCase().trim())
        const uniqueDomains = Array.from(new Set(normalizedDomains))
        setDomains(uniqueDomains)
        
        // Update selected domain if it was deleted (normalize for comparison)
        const savedDomain = localStorage.getItem('selectedDomain')
        const normalizedSavedDomain = savedDomain ? savedDomain.toLowerCase().trim() : null
        if (normalizedSavedDomain && !uniqueDomains.includes(normalizedSavedDomain)) {
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
    window.addEventListener('paymentSuccess', handlePaymentSuccess)
    
    return () => {
      window.removeEventListener('domainChanged', handleCustomStorageChange)
      window.removeEventListener('domainsReload', handleDomainsReload)
      window.removeEventListener('paymentSuccess', handlePaymentSuccess)
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
    // Normalize domain (remove protocol, www, trailing slash, lowercase, trim)
    const normalizedDomain = newDomain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase()
      .trim()
    
    // Add to sidebar (audit already completed successfully) - deduplicate
    if (normalizedDomain) {
      setDomains(prev => {
        const normalized = prev.map(d => d.toLowerCase().trim())
        if (!normalized.includes(normalizedDomain)) {
          return [...prev, normalizedDomain]
        }
        return prev
      })
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
          // Normalize and deduplicate domains
          const normalizedDomains = audits
            .map(a => a.domain)
            .filter((d): d is string => d !== null)
            .map(d => d.toLowerCase().trim())
          const uniqueDomains = Array.from(new Set(normalizedDomains))
          setDomains(uniqueDomains)
          
          // Ensure new domain is still selected after reload (normalize for comparison)
          const normalizedForComparison = normalizedDomain.toLowerCase().trim()
          if (uniqueDomains.includes(normalizedForComparison)) {
            setSelectedDomain(normalizedForComparison)
            localStorage.setItem('selectedDomain', normalizedForComparison)
            window.dispatchEvent(new Event('domainChanged'))
          }
        }
      } catch (error) {
        console.error("Error loading domains:", error)
      }
    }
    loadDomains()
  }

  if (loading) {
    return null
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Domains</SidebarGroupLabel>
      <SidebarMenu>
        {domains.map((domain, index) => (
          <SidebarMenuItem key={`${domain}-${index}`}>
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
            onClick={handleNewDomainClick}
            tooltip="New Domain"
            disabled={checkingLimit}
          >
            {checkingLimit ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>New Domain</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <NewAuditDialog
        open={newAuditDialogOpen}
        onOpenChange={setNewAuditDialogOpen}
        onSuccess={handleNewAuditSuccess}
      />
      <DomainLimitReachedModal
        open={domainLimitModalOpen}
        onOpenChange={setDomainLimitModalOpen}
        plan={limitPlan}
        currentDomains={currentDomains}
        domainLimit={domainLimit}
      />
    </SidebarGroup>
  )
}

