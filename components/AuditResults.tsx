"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, CheckCircle2, Sparkles, LockKeyhole, Mail, Loader2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase-browser"

interface AuditResultsProps {
  results: any
  isAuthenticated?: boolean
  sessionToken?: string | null
  onEmailCapture?: (email: string) => void
}

// Number of issues to show before fade out
const VISIBLE_ISSUES = 3
// Number of pages to show initially
const INITIAL_PAGES_SHOWN = 6
// Max title length before truncation
const MAX_TITLE_LENGTH = 60

export function AuditResults({ 
  results, 
  isAuthenticated = false, 
  sessionToken,
  onEmailCapture 
}: AuditResultsProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set())
  const [showPages, setShowPages] = useState(false)
  
  // Inline email capture state
  const [email, setEmail] = useState("")
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState("")

  // Toggle issue expansion
  const toggleIssue = (index: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Inline email capture handler
  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || emailLoading) return

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address")
      return
    }

    setEmailLoading(true)
    setEmailError("")

    try {
      const supabase = createClient()
      
      // Store audit data in localStorage before sending magic link
      // So we can claim it after auth
      if (sessionToken && results) {
        localStorage.setItem('pendingAudit', JSON.stringify({
          sessionToken,
          auditData: results,
          email,
          expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        }))
      }
      
      // Send magic link
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const callbackUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent('/dashboard')}`
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl }
      })

      if (error) throw error
      
      setEmailSent(true)
      onEmailCapture?.(email)
    } catch (err) {
      console.error('Email capture error:', err)
      setEmailError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setEmailLoading(false)
    }
  }

  // Handle "Email me this report" - same flow but different messaging
  const handleEmailReport = async () => {
    if (!email) {
      setEmailError("Enter your email above first")
      return
    }
    await handleSaveAudit({ preventDefault: () => {} } as React.FormEvent)
  }

  if (!results) return null

  // Check if fix should be gated for this issue index
  const isFixGated = (index: number) => {
    if (isAuthenticated) return false
    return index >= VISIBLE_ISSUES
  }

  return (
    <section className="container mx-auto px-6 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="max-w-4xl mx-auto">
        
        {/* Email sent confirmation */}
        {emailSent && (
          <div className="mb-8 p-6 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="font-medium text-green-900 dark:text-green-100">
                Check your email!
              </p>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              We sent a link to <span className="font-medium">{email}</span>. Click it to save your audit and unlock all recommendations.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h2 className="font-serif text-3xl font-medium mb-4">Audit Results</h2>
          
          {/* Audited Pages - Collapsible */}
          {results.meta?.auditedUrls && results.meta.auditedUrls.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowPages((prev) => !prev)}
                className="flex items-center justify-between w-full text-left p-4 border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Pages we audited</p>
                  <p className="text-xs text-muted-foreground">{results.meta.auditedUrls.length} URLs audited</p>
                </div>
                {showPages ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              
              {showPages && (
                <div className="border-l border-r border-b border-border bg-background p-4">
                  <div className="space-y-2">
                    {results.meta.auditedUrls.slice(0, INITIAL_PAGES_SHOWN).map((url: string, idx: number) => {
                      let display = url
                      try {
                        const u = new URL(url)
                        display = u.pathname || u.href
                      } catch {
                        display = url
                      }
                      return (
                        <div key={idx} className="text-sm text-muted-foreground truncate">
                          {display}
                        </div>
                      )
                    })}
                    {results.meta.auditedUrls.length > INITIAL_PAGES_SHOWN && (
                      <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                        +{results.meta.auditedUrls.length - INITIAL_PAGES_SHOWN} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {results.groups && results.groups.length > 0 ? (
          <div className="space-y-4">
            {/* Issue Cards */}
            {results.groups.map((group: any, i: number) => {
              const isExpanded = expandedIssues.has(i)
              const isHigh = group.severity === 'high'
              const isMedium = group.severity === 'medium'
              const fixIsGated = isFixGated(i)
              
              // Fade out after 3 issues for unauthenticated users
              const shouldFade = !isAuthenticated && i >= VISIBLE_ISSUES
              
              return (
                <div
                  key={i}
                  className={`relative border border-border bg-background ${
                    shouldFade ? 'opacity-40' : ''
                  }`}
                >
                  {shouldFade && (
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-10 pointer-events-none" />
                  )}
                  
                  {/* Card Header - Always Visible */}
                  <button
                    onClick={() => !shouldFade && toggleIssue(i)}
                    disabled={shouldFade}
                    className={`w-full text-left p-6 hover:bg-muted/30 transition-colors ${
                      shouldFade ? 'cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Severity first */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`h-2 w-2 shrink-0 ${
                            isHigh ? 'bg-red-500' : 
                            isMedium ? 'bg-orange-500' : 
                            'bg-blue-500'
                          }`} />
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            isHigh ? 'text-red-600 dark:text-red-400' :
                            isMedium ? 'text-orange-600 dark:text-orange-400' :
                            'text-blue-600 dark:text-blue-400'
                          }`}>
                            {group.severity}
                          </span>
                        </div>
                        
                        {/* Title second */}
                        <h3 className="font-serif text-xl font-semibold text-foreground mb-3" title={group.title}>
                          {group.title.length > MAX_TITLE_LENGTH 
                            ? `${group.title.substring(0, MAX_TITLE_LENGTH).trim()}...` 
                            : group.title}
                        </h3>
                        
                        {/* Impact third */}
                        {group.impact && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {group.impact}
                          </p>
                        )}
                      </div>
                      {!shouldFade && (
                        <div className="shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && !shouldFade && (
                    <div className="border-t border-border p-6 space-y-6">
                      {/* Evidence Section */}
                      {group.examples && group.examples.length > 0 && (
                        <div>
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            Evidence Found
                          </h4>
                          <div className="space-y-3">
                            {group.examples.slice(0, 3).map((ex: any, j: number) => {
                              const shortSnippet = ex.snippet.length > 120 
                                ? ex.snippet.substring(0, 120).trim() + '...' 
                                : ex.snippet
                              return (
                                <div key={j} className="pl-4 border-l-2 border-border">
                                  <p className="text-sm text-foreground/80 italic mb-1.5 leading-relaxed">
                                    "{shortSnippet}"
                                  </p>
                                  <a
                                    href={ex.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
                                  >
                                    {ex.url}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Fix Section */}
                      {!fixIsGated && group.fix ? (
                        <div>
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            Recommendation
                          </h4>
                          <div className="bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30 p-6">
                            <div className="flex items-start gap-4">
                              <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                              </div>
                              <p className="text-sm text-green-800/90 dark:text-green-200/80 leading-relaxed">
                                {group.fix}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            Recommendation
                          </h4>
                          <div className="border border-dashed border-border bg-muted/30 p-8 text-center">
                            <div className="max-w-xs mx-auto space-y-4">
                              <div className="mx-auto h-10 w-10 bg-background border flex items-center justify-center">
                                <LockKeyhole className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground mb-1">Save to unlock fix</p>
                                <p className="text-sm text-muted-foreground">
                                  Enter your email above to save this audit and see all recommendations.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Sign Up CTA - Minimal, not newsletter-like */}
            {!isAuthenticated && !emailSent && results.totalIssues > VISIBLE_ISSUES && (
              <div className="mt-8 p-6 border-t-2 border-border">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      {results.totalIssues - VISIBLE_ISSUES} more {results.totalIssues - VISIBLE_ISSUES === 1 ? 'issue' : 'issues'} available
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sign up to view all issues and recommendations
                    </p>
                  </div>
                  <form onSubmit={handleSaveAudit} className="flex gap-2 shrink-0">
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={emailLoading}
                      className="w-48"
                    />
                    <Button type="submit" disabled={emailLoading || !email}>
                      {emailLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Sign Up"
                      )}
                    </Button>
                  </form>
                </div>
                {emailError && (
                  <p className="text-sm text-red-600 mt-2">{emailError}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <Card className="border-2 border-dashed">
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="font-serif text-2xl font-semibold mb-2">No issues found</h3>
              <p className="text-muted-foreground">
                Your content looks great! Keep up the good work.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
