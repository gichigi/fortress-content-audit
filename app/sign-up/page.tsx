"use client"

import * as React from "react"
import { useState, Suspense } from "react"
import { Mail, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

function SignUpForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  // Default to dashboard after auth, or use provided next param
  const next = searchParams.get("next") || "/dashboard"
  const authError = searchParams.get("error")

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleMagicLink = async (e: React.FormEvent) => {
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
      // Redirect through auth callback which handles session + profile creation
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const callbackUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`
      
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl },
      })
      
      if (signInError) throw signInError
      
      setMagicLinkSent(true)
      toast({
        title: "Check your email",
        description: "We've sent you a secure link to continue.",
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send magic link.")
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to send magic link.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError("")
    
    try {
      const supabase = createClient()
      // Redirect through auth callback which handles session + profile creation
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const callbackUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`
      
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      })
      
      if (oauthError) throw oauthError
      
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.")
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Google sign-in failed.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  // Show success state after magic link is sent
  if (magicLinkSent) {
    return (
      <div className="text-center">
        <div className="mb-8">
          <div className="w-16 h-16 border-2 border-border flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="font-serif text-3xl font-light tracking-tight mb-4">
            Check your email
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We've sent a secure link to <span className="font-medium text-foreground">{email}</span>.
            Click the link to continue.
          </p>
        </div>
        
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground mb-4">
            Didn't receive the email?
          </p>
          <Button 
            variant="outline" 
            onClick={() => setMagicLinkSent(false)}
            className="w-full"
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h2 className="font-serif text-4xl font-light tracking-tight mb-4">
          Continue with email
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We'll send you a secure link. No password needed.
        </p>
      </div>

      {authError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Authentication failed</AlertTitle>
          <AlertDescription>
            There was a problem signing you in. Please try again.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleMagicLink} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
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
            "Email me a link"
          )}
        </Button>
      </form>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-4 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <Button 
        variant="outline" 
        onClick={handleGoogle}
        disabled={loading}
        className="w-full"
      >
        <img
          src="https://www.svgrepo.com/show/475656/google-color.svg"
          alt="Google"
          className="w-5 h-5 mr-2"
        />
        Google
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-8">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-foreground">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          privacy policy
        </Link>
        .
      </p>
    </>
  )
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <nav className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-2xl font-serif font-semibold tracking-tight">
            Fortress
          </Link>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Suspense fallback={
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          }>
            <SignUpForm />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have guidelines?{" "}
            <Link href="/dashboard" className="underline hover:text-foreground">
              Go to dashboard
            </Link>
          </p>
        </div>
      </footer>

      <Toaster />
    </div>
  )
}
