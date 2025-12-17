"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase-browser"
import { Globe, Check, ChevronRight, Plus } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { NewAuditDialog } from "@/components/new-audit-dialog"

export function DomainSwitcher() {
  const [domains, setDomains] = React.useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)
  const [newAuditDialogOpen, setNewAuditDialogOpen] = React.useState(false)

  React.useEffect(() => {
    const loadDomains = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

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

    // Listen for custom event (same window)
    const handleCustomStorageChange = () => {
      const domain = localStorage.getItem('selectedDomain')
      setSelectedDomain(domain)
    }
    window.addEventListener('domainChanged', handleCustomStorageChange)

    return () => {
      window.removeEventListener('domainChanged', handleCustomStorageChange)
    }
  }, [])

  const handleDomainChange = (domain: string) => {
    setSelectedDomain(domain)
    localStorage.setItem('selectedDomain', domain)
    // Dispatch custom event for same-window updates
    window.dispatchEvent(new Event('domainChanged'))
    setOpen(false)
  }

  const handleNewAuditSuccess = () => {
    // Reload domains after new audit
    const loadDomains = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

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
    <SidebarGroup>
      <SidebarGroupContent>
        <Collapsible open={open} onOpenChange={setOpen}>
          <SidebarMenu>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Switch Domain">
                  <Globe className="h-4 w-4" />
                  <span>{selectedDomain || 'Select Domain'}</span>
                  <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {domains.map((domain) => (
                    <SidebarMenuSubItem key={domain}>
                      <SidebarMenuSubButton
                        onClick={() => handleDomainChange(domain)}
                        className="w-full justify-between"
                      >
                        <span>{domain}</span>
                        {selectedDomain === domain && (
                          <Check className="h-4 w-4" />
                        )}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setNewAuditDialogOpen(true)}
                tooltip="New Audit"
              >
                <Plus className="h-4 w-4" />
                <span>New Audit</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </Collapsible>
      </SidebarGroupContent>
      <NewAuditDialog
        open={newAuditDialogOpen}
        onOpenChange={setNewAuditDialogOpen}
        onSuccess={handleNewAuditSuccess}
      />
    </SidebarGroup>
  )
}

