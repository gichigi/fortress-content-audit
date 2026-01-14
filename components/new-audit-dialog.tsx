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

  // Poll for audit completion (runs after dialog closes)
  const pollForCompletion = useCallback(async (runId: string, domainName: string) => {
    const maxAttempts = 20 // 5 minutes max (15s intervals)
    let attempts = 0
    
    const poll = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        
        const response = await fetch(`/api/audit/${runId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (!response.ok) {
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(poll, 15000) // Poll every 15 seconds
          }
          return
        }
        
        const data = await response.json()
        
        // Check if audit failed
        if (data.status === 'failed') {
          toast({
            title: "Audit failed",
            description: data.error || "The audit encountered an error. Please try again.",
            variant: "destructive",
          })
          return
        }
        
        // Check if audit is complete (status completed, regardless of issue count)
        if (data.status === 'completed') {
          toast({
            title: "Audit completed",
            description: `${domainName} has been audited successfully.`,
          })
          if (onSuccess) {
            onSuccess(domainName)
          }
          return
        }
        
        // Still pending - continue polling
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 15000) // Poll every 15 seconds
        } else {
          // Timeout - audit may still complete, user can refresh
          console.log('[NewAuditDialog] Polling timeout, audit may still be running')
        }
      } catch (error) {
        console.error('[NewAuditDialog] Poll error:', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 15000) // Poll every 15 seconds
        }
      }
    }
    
    // Start polling after a short delay
    setTimeout(poll, 3000)
  }, [toast, onSuccess])

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

  // Listen for payment success to refresh plan data
  useEffect(() => {
    const handlePaymentSuccess = () => {
      loadUsageInfo()
    }
    window.addEventListener('paymentSuccess', handlePaymentSuccess)
    return () => {
      window.removeEventListener('paymentSuccess', handlePaymentSuccess)
    }
  }, [loadUsageInfo])

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

      // If response.ok, validation passed and audit started in background
      if (response.ok) {
        const data = await response.json()
        
        // Close dialog and show "started" toast immediately
        const durationText = plan === 'pro' || plan === 'enterprise' 
          ? ' This may take up to 15 minutes.' 
          : ' This may take a few minutes.'
        toast({
          title: "Audit started",
          description: `Auditing ${normalizedDomain}...${durationText}`,
        })
        onOpenChange(false)
        setDomain("")
        setLoading(false)
        
        // Audit is running in background - poll for completion
        if (data.runId && data.status === 'pending') {
          pollForCompletion(data.runId, normalizedDomain)
        } else if (data.status === 'completed') {
          // Audit already completed (mock data or very fast)
          toast({
            title: "Audit completed",
            description: `${normalizedDomain} has been audited successfully.`,
          })
          if (onSuccess) {
            onSuccess(normalizedDomain)
          }
        } else if (data.status === 'failed') {
          // Audit failed immediately (shouldn't happen but handle it)
          toast({
            title: "Audit failed",
            description: data.error || "The audit encountered an error. Please try again.",
            variant: "destructive",
          })
        }
        
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

