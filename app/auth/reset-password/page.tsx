"use client"

import * as React from "react"
import { useState } from "react"
import { Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { toast } = useToast()

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError("Please enter your email.")
      return
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.")
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/update-password`,
      })
      
      if (resetError) throw resetError
      
      setEmailSent(true)
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reset email.")
      toast({
        title: "Unable to send reset email",
        description: e instanceof Error ? e.message : "Please try again or contact support if the issue persists.",
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-sm text-center">
            <div className="mb-8">
              <div className="w-16 h-16 border-2 border-border flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="font-serif text-3xl font-light tracking-tight mb-4">
                Check your email
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
              </p>
            </div>
            
            <Link href="/sign-up">
              <Button variant="outline" className="w-full">
                Back to sign in
              </Button>
            </Link>
          </div>
        </main>
        
        <Toaster />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h2 className="font-serif text-4xl font-light tracking-tight mb-2">
              Reset password
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
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
                  Sending...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            <Link href="/sign-up" className="underline hover:text-foreground">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>

      <Toaster />
    </div>
  )
}


