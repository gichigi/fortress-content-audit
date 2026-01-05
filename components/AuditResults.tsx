"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FileText, Search, AlertCircle, CheckCircle2, Sparkles, LockKeyhole, Clock, Mail, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase-browser"
import { EmptyAuditState } from "@/components/empty-audit-state"

interface AuditResultsProps {
  results: any
  isAuthenticated?: boolean
  sessionToken?: string | null
  onEmailCapture?: (email: string) => void
}

// Number of issues where we show full fix/recommendation
const FREE_FIX_LIMIT = 2

export function AuditResults({ 
  results, 
  isAuthenticated = false, 
  sessionToken,
  onEmailCapture 
}: AuditResultsProps) {
  const router = useRouter()
  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number>(0)
  const [showPages, setShowPages] = useState(false)
  
  // Inline email capture state
  const [email, setEmail] = useState("")
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState("")

  // Handle issue selection - no more click gating!
  const handleIssueClick = (index: number) => {
    setSelectedIssueIndex(index)
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
    return index >= FREE_FIX_LIMIT
  }

  return (
    <section className="container mx-auto px-6 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="max-w-6xl mx-auto">
        
        {/* Expiry Banner - only for unauthenticated users */}
        {!isAuthenticated && !emailSent && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    This audit expires in 24 hours
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Save it to your account to keep it forever and unlock all recommendations.
                  </p>
                </div>
              </div>
              
              {/* Inline email capture */}
              <form onSubmit={handleSaveAudit} className="flex gap-2 shrink-0">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-48 bg-white dark:bg-background"
                  disabled={emailLoading}
                />
                <Button type="submit" disabled={emailLoading || !email}>
                  {emailLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save Audit"
                  )}
                </Button>
              </form>
            </div>
            {emailError && (
              <p className="text-sm text-red-600 mt-2">{emailError}</p>
            )}
          </div>
        )}

        {/* Email sent confirmation */}
        {emailSent && (
          <div className="mb-8 p-6 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 rounded-lg text-center">
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
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-serif text-3xl font-medium">Audit Results</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full">
              <FileText className="h-4 w-4" />
              <span>{results.meta?.pagesAudited || 0} pages audited</span>
            </div>
            {results.meta?.discoveredPages && results.meta.discoveredPages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setShowPages((prev) => !prev)}
              >
                {showPages ? "Hide pages" : "Show pages"} ({results.meta.discoveredPages.length})
              </Button>
            )}
            {results.totalIssues > 0 && (
              <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium text-foreground">{results.totalIssues} issues found</span>
              </div>
            )}
          </div>
        </div>

        {/* Discovered Pages Panel */}
        {showPages && results.meta?.discoveredPages && results.meta.discoveredPages.length > 0 && (
          <div className="mb-8">
            <Card className="border bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">Pages we found on your site</p>
                  <span className="text-xs text-muted-foreground">{results.meta.discoveredPages.length} URLs</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {results.meta.discoveredPages.slice(0, 18).map((page: any, idx: number) => {
                    let display = page.title || ""
                    try {
                      const u = new URL(page.url)
                      display = display || u.pathname || u.href
                    } catch {
                      display = display || page.url
                    }
                    return (
                      <div key={idx} className="text-sm text-muted-foreground truncate">
                        {display}
                      </div>
                    )
                  })}
                </div>
                {results.meta.discoveredPages.length > 18 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{results.meta.discoveredPages.length - 18} more
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {results.groups && results.groups.length > 0 ? (
          <div className="space-y-8">
            <div className="grid lg:grid-cols-[320px_1fr] gap-8 items-start">
              
              {/* Left Sidebar: Issue List - NO MORE LOCKS on titles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Detected Issues</h3>
                  <span className="text-xs text-muted-foreground">{results.totalIssues} found</span>
                </div>
                
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {results.groups.map((group: any, i: number) => {
                    // Skip if we're in preview mode and this is beyond the limit
                    if (results.preview && i >= 7) return null
                    
                    const isSelected = selectedIssueIndex === i
                    const isHigh = group.severity === 'high'
                    const isMedium = group.severity === 'medium'
                    
                    return (
                      <button
                        key={i}
                        onClick={() => handleIssueClick(i)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected 
                            ? 'bg-background border-foreground/20 shadow-sm ring-1 ring-foreground/5' 
                            : 'bg-muted/30 border-transparent hover:bg-muted/50 hover:border-border/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                            isHigh ? 'bg-red-500 shadow-[0_0_8px_-1px_rgba(239,68,68,0.5)]' : 
                            isMedium ? 'bg-orange-500 shadow-[0_0_8px_-1px_rgba(249,115,22,0.5)]' : 
                            'bg-blue-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-tight mb-1 truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {group.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                              {group.severity} Impact
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  
                  {/* Preview Teaser in List */}
                  {results.preview && results.totalIssues > 7 && (
                    <div className="p-4 rounded-lg border border-dashed border-border bg-muted/10 text-center">
                      <p className="text-xs text-muted-foreground mb-2">+{results.totalIssues - 7} more issues</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs h-7"
                        onClick={() => {
                          if (!email) {
                            // Scroll to email input
                            document.querySelector('input[type="email"]')?.scrollIntoView({ behavior: 'smooth' })
                          } else {
                            handleEmailReport()
                          }
                        }}
                      >
                        Save Full Report
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content: Selected Issue Detail - Always shows, fix may be gated */}
              <div className="min-h-[400px]">
                {results.groups[selectedIssueIndex] && (
                  <Card className="border shadow-sm overflow-hidden sticky top-24">
                    {(() => {
                      const group = results.groups[selectedIssueIndex]
                      const isHigh = group.severity === 'high'
                      const isMedium = group.severity === 'medium'
                      const fixIsGated = isFixGated(selectedIssueIndex)
                      
                      return (
                        <>
                          {/* Header - Always visible */}
                          <div className="p-8 border-b bg-muted/5">
                            <div className="flex items-start justify-between gap-6 mb-6">
                              <h2 className="font-serif text-2xl font-medium tracking-tight text-foreground leading-snug">
                                {group.title}
                              </h2>
                              <div className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border shrink-0 ${
                                isHigh ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' :
                                isMedium ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800' :
                                'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
                              }`}>
                                {group.severity}
                              </div>
                            </div>
                            
                            {/* Impact - Always visible */}
                            {group.impact && (
                              <div className="flex items-start gap-3 p-4 rounded-lg bg-background border border-border/50 shadow-sm">
                                <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1 tracking-wider">Business Impact</p>
                                  <p className="text-sm text-foreground/90">{group.impact}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-8 space-y-8">
                            {/* Evidence Section - Always visible */}
                            <div>
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                Evidence Found
                              </h4>
                              
                              {group.examples && group.examples.length > 0 ? (
                                <div className="space-y-3">
                                  {group.examples.slice(0, 3).map((ex: any, j: number) => {
                                     const shortSnippet = ex.snippet.length > 120 
                                      ? ex.snippet.substring(0, 120).trim() + '...' 
                                      : ex.snippet
                                    return (
                                      <div key={j} className="group/ex relative pl-4 border-l-2 border-border hover:border-foreground/30 transition-colors">
                                        <p className="text-sm text-foreground/80 italic mb-1.5 leading-relaxed">"{shortSnippet}"</p>
                                        <div className="flex items-center gap-2">
                                          <span className="h-px w-3 bg-border"></span>
                                          <p className="text-xs text-muted-foreground font-mono truncate">{ex.url}</p>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">No specific examples captured.</p>
                              )}
                            </div>

                            {/* Fix Section - May be gated */}
                            <div>
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                                <Sparkles className="h-4 w-4 text-muted-foreground" />
                                Recommendation
                              </h4>
                              
                              {!fixIsGated && group.fix ? (
                                <div className="bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30 rounded-xl p-6">
                                  <div className="flex items-start gap-4">
                                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="font-medium text-green-900 dark:text-green-100">Recommended Action</p>
                                      <p className="text-sm text-green-800/90 dark:text-green-200/80 leading-relaxed">
                                        {group.fix}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                                  <div className="max-w-xs mx-auto space-y-4">
                                    <div className="mx-auto h-10 w-10 rounded-full bg-background border shadow-sm flex items-center justify-center">
                                      <LockKeyhole className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-foreground mb-1">Save to unlock fix</p>
                                      <p className="text-sm text-muted-foreground">
                                        Enter your email above to save this audit and see all recommendations.
                                      </p>
                                    </div>
                                    {!emailSent && (
                                      <div className="space-y-2">
                                        <Input
                                          type="email"
                                          placeholder="you@example.com"
                                          value={email}
                                          onChange={(e) => setEmail(e.target.value)}
                                          className="text-center"
                                          disabled={emailLoading}
                                        />
                                        <Button 
                                          className="w-full"
                                          onClick={handleEmailReport}
                                          disabled={emailLoading || !email}
                                        >
                                          {emailLoading ? (
                                            <>
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              Sending...
                                            </>
                                          ) : (
                                            "Save My Audit"
                                          )}
                                        </Button>
                                      </div>
                                    )}
                                    {emailSent && (
                                      <p className="text-sm text-green-600">
                                        Check your email to complete saving!
                                      </p>
                                    )}
                                    {emailError && (
                                      <p className="text-sm text-red-600">{emailError}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </Card>
                )}
              </div>
            </div>

            {/* Bottom CTA - Email me this report */}
            {!isAuthenticated && !emailSent && (
              <div className="mt-8 p-6 border rounded-lg bg-muted/20 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">Want this report emailed to you?</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Get the full audit with all {results.totalIssues} issues and recommendations sent to your inbox.
                </p>
                <form onSubmit={handleSaveAudit} className="flex gap-2 max-w-md mx-auto">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailLoading}
                  />
                  <Button type="submit" disabled={emailLoading || !email}>
                    {emailLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Email Me"
                    )}
                  </Button>
                </form>
                {emailError && (
                  <p className="text-sm text-red-600 mt-2">{emailError}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <EmptyAuditState variant="card" />
        )}
      </div>
    </section>
  )
}