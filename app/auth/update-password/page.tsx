"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Loader2, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    // Handle password reset flow per Supabase SDK best practices
    // User arrives here from /auth/confirm which verifies token_hash via verifyOtp
    // and creates a session before redirecting with ?recovery=true
    const handleRecoveryFlow = async () => {
      setIsVerifying(true)
      const supabase = createClient()
      const params = new URLSearchParams(window.location.search)
      const recoveryParam = params.get('recovery')
      
      // Check if we're in recovery flow (from sessionStorage or query param)
      const storedFlag = sessionStorage.getItem('password_recovery_in_progress')
      const isRecoveryFlow = storedFlag === 'true' || recoveryParam === 'true'
      
      // If recovery param is present, set sessionStorage flag and clean URL
      if (recoveryParam === 'true') {
        sessionStorage.setItem('password_recovery_in_progress', 'true')
        router.replace(window.location.pathname, { scroll: false })
      }
      
      // Check for existing session (created by /auth/confirm via verifyOtp)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // No session - user didn't come through proper recovery flow
        setIsVerifying(false)
        sessionStorage.removeItem('password_recovery_in_progress')
        router.push('/sign-up?error=invalid_reset_link')
        return
      }
      
      // If user has a session but didn't come from recovery flow, redirect to dashboard
      // This prevents authenticated users from accessing this page directly
      if (!isRecoveryFlow) {
        setIsVerifying(false)
        router.push('/dashboard')
        return
      }
      
      // Valid recovery flow - allow access
      setIsVerifying(false)
    }
    
    handleRecoveryFlow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validatePassword = (password: string) => {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password) {
      setError("Please enter a new password.")
      return
    }
    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters and include both letters and numbers.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })
      
      if (updateError) throw updateError
      
      toast({
        title: "Password updated",
        description: "Your password has been successfully updated.",
      })
      
      // Clear recovery flow marker
      sessionStorage.removeItem('password_recovery_in_progress')
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard")
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password.")
      toast({
        title: "Unable to update password",
        description: e instanceof Error ? e.message : "Please try again or contact support if the issue persists.",
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while verifying session
  if (isVerifying) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-sm text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Verifying reset link...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h2 className="font-serif text-4xl font-light tracking-tight mb-2">
              Update password
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Enter your new password
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Password must be at least 8 characters with letters and numbers
          </p>
        </div>
      </main>

      <Toaster />
    </div>
  )
}


