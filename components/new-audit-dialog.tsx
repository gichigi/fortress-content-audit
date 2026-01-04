"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase-browser"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertCircle } from "lucide-react"

interface NewAuditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (newDomain: string) => void
}

interface UsageInfo {
  domains: number
  domainLimit: number
  today: number
  limit: number
}

export function NewAuditDialog({ open, onOpenChange, onSuccess }: NewAuditDialogProps) {
  const { toast } = useToast()
  const [domain, setDomain] = useState("")
  const [loading, setLoading] = useState(false)
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)
  const [plan, setPlan] = useState<string>("free")
  const [error, setError] = useState<string | null>(null)

  const loadUsageInfo = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Get plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', session.user.id)
        .maybeSingle()
      
      if (profile) {
        setPlan(profile.plan || 'free')
      }

      // Get usage info
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
  }, [])

  // Load usage info and plan when dialog opens
  useEffect(() => {
    if (open) {
      loadUsageInfo()
      // Reset states when dialog opens
      setDomain("")
      setError(null)
    }
  }, [open, loadUsageInfo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!domain.trim()) {
      setError("Please enter a website URL")
      return
    }

    setLoading(true)
    setError(null)

    // Normalize domain for display
    const inputDomain = domain.trim()
    const normalizedDomain = inputDomain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        setError("Not authenticated. Please sign in and try again.")
        return
      }

      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || ''

      const response = await fetch(`${baseUrl}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ domain: inputDomain })
      })

      // If response.ok, validation passed and audit started
      if (response.ok) {
        // Close dialog and show "started" toast immediately
        toast({
          title: "Audit started",
          description: `Auditing ${normalizedDomain}...`,
        })
        onOpenChange(false)
        setDomain("")
        setLoading(false)
        
        // Handle response body in background (don't block dialog close)
        // Use a separate async function to avoid blocking
        ;(async () => {
          try {
            const data = await response.json()
            
            if (data.status === 'completed') {
              toast({
                title: "Audit completed",
                description: `${normalizedDomain} has been audited successfully.`,
              })
              if (onSuccess) {
                onSuccess(normalizedDomain)
              }
            } else {
              // Bot protection or other errors
              toast({
                title: "Audit failed",
                description: data.error || `Audit failed with status: ${data.status || 'unknown'}`,
                variant: "error",
              })
            }
          } catch (error) {
            console.error('Error parsing audit response:', error)
            toast({
              title: "Audit failed",
              description: "Failed to parse audit response. Please check the dashboard.",
              variant: "error",
            })
          }
        })()
        
        // Return early - don't wait for response body
        return
      } else {
        // Validation errors - show in dialog, keep open
        setLoading(false)
        const errorData = await response.json().catch(() => ({}))
        
        // Provide specific error messages
        let errorMessage = 'Failed to start audit'
        if (response.status === 429) {
          errorMessage = errorData.message || 'Daily limit reached'
        } else if (response.status === 403) {
          errorMessage = 'This feature requires a paid plan. Upgrade to Pro or Enterprise.'
        } else if (response.status === 400) {
          errorMessage = errorData.error || 'Invalid domain. Please check the URL and try again.'
        } else if (response.status === 401) {
          errorMessage = 'Authentication required. Please sign in and try again.'
        } else {
          errorMessage = errorData.error || `Failed to start audit (${response.status})`
        }
        
        setError(errorMessage)
      }
    } catch (error) {
      console.error('Audit error:', error)
      setLoading(false)
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to start audit. Please try again."
      
      setError(errorMessage)
    }
  }

  const isAtDomainLimit = plan === 'free' 
    ? usageInfo?.domains >= 1
    : plan === 'pro'
    ? usageInfo?.domains >= 5
    : false

  const domainLimit = plan === 'free' ? 1 : plan === 'pro' ? 5 : Infinity
  const canAddDomain = !isAtDomainLimit || plan === 'enterprise'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-semibold">New Domain</DialogTitle>
          <DialogDescription>
            Start a new content audit for a domain.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Domain Limit Warning */}
            {isAtDomainLimit && plan !== 'enterprise' && (
              <Alert variant="outline">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Domain limit reached ({domainLimit} domain{domainLimit === 1 ? '' : 's'}). 
                  {plan === 'free' && ' Upgrade to Pro to audit up to 5 domains.'}
                  {plan === 'pro' && ' Upgrade to Enterprise for unlimited domains.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Domain Input */}
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={loading || !canAddDomain}
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain you want to audit (e.g., example.com)
              </p>
            </div>

            {/* Error Message - only show for client-side validation */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setDomain("")
                setError(null)
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !canAddDomain || !domain.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running audit...
                </>
              ) : (
                "Start Audit"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

