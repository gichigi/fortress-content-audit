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
  onSuccess?: () => void
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

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError("Not authenticated")
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
        body: JSON.stringify({ domain: domain.trim() })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // Provide specific error messages
        if (response.status === 429) {
          const limitMessage = errorData.message || 'Daily limit reached'
          throw new Error(limitMessage)
        } else if (response.status === 403) {
          throw new Error('This feature requires a paid plan. Upgrade to Pro or Enterprise.')
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Invalid domain. Please check the URL and try again.')
        } else if (response.status === 401) {
          throw new Error('Authentication required. Please sign in and try again.')
        } else {
          throw new Error(errorData.error || `Failed to start audit (${response.status})`)
        }
      }

      const data = await response.json()

      toast({
        title: "Audit started",
        description: "Your audit is running in the background. You'll receive an email when it's complete.",
      })

      // Close dialog and reset form
      setDomain("")
      onOpenChange(false)
      
      // Call success callback to refresh data
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Audit error:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to start audit. Please try again."
      setError(errorMessage)
      // Don't close dialog on error so user can see the error and retry
    } finally {
      setLoading(false)
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
          <DialogTitle className="font-serif text-2xl font-semibold">New Audit</DialogTitle>
          <DialogDescription>
            Start a new content audit for a domain. {plan === 'enterprise' ? 'Unlimited domains.' : `You can audit up to ${domainLimit} domain${domainLimit === 1 ? '' : 's'}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Usage Info */}
            {usageInfo && (
              <div className="text-sm text-muted-foreground space-y-1">
                {usageInfo.domainLimit > 0 && (
                  <div>
                    Domains: {usageInfo.domains}/{usageInfo.domainLimit}
                  </div>
                )}
                {usageInfo.limit > 0 && (
                  <div>
                    Audits today: {usageInfo.today}/{usageInfo.limit}
                  </div>
                )}
              </div>
            )}

            {/* Domain Limit Warning */}
            {isAtDomainLimit && plan !== 'enterprise' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You've reached your domain limit ({domainLimit} domain{domainLimit === 1 ? '' : 's'}). 
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

            {/* Error Message */}
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
                  Starting...
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

