"use client"

import * as React from "react"
import { useState, Suspense, useEffect } from "react"
import { Loader2, Eye, EyeOff } from "lucide-react"
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
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  // Default to dashboard after auth, or use provided next param
  const next = searchParams.get("next") || "/dashboard"
  const authError = searchParams.get("error")

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          // User is already authenticated, redirect to dashboard
          router.push(next)
          return
        }
      } catch (error) {
        console.error("Error checking auth:", error)
      } finally {
        setIsCheckingAuth(false)
      }
    }
    
    checkAuth()
  }, [router, next])

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validatePassword = (password: string) => {
    // Minimum 8 characters, at least one letter and one number
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
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
    if (!password) {
      setError("Please enter your password.")
      return
    }
    
    // Validate password strength for sign-up
    if (mode === "sign-up" && !validatePassword(password)) {
      setError("Password must be at least 8 characters and include both letters and numbers.")
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      const supabase = createClient()
      
      if (mode === "sign-in") {
        // Sign in flow
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (signInError) {
          // Handle specific error cases
          const errorMessage = signInError.message.toLowerCase()
          
          if (errorMessage.includes('email not confirmed') || errorMessage.includes('email_not_confirmed')) {
            throw new Error("Please check your email and click the confirmation link before signing in.")
          }
          
          if (errorMessage.includes('invalid login credentials') || errorMessage.includes('invalid_credentials')) {
            throw new Error("Invalid email or password. If you just signed up, make sure you've confirmed your email first. Don't have an account? Click 'Sign up' below.")
          }
          
          throw signInError
        }
        
        if (signInData.session) {
          // Successfully signed in
          router.push(next)
          return
        }
      } else {
        // Sign up flow
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        })
        
        if (signUpError) {
          // If user already exists, suggest sign-in
          if (signUpError.message.includes('already registered')) {
            throw new Error("An account with this email already exists. Click 'Sign in' below.")
          }
          throw signUpError
        }
        
        // New user - check if email confirmation is required
        if (signUpData.user && !signUpData.session) {
          // Email confirmation required
          toast({
            title: "Check your email",
            description: "Please confirm your email address to continue.",
          })
        } else if (signUpData.session) {
          // Auto-confirmed, redirect
          router.push(next)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.")
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Authentication failed.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === "sign-in" ? "sign-up" : "sign-in")
    setError("")
    setPassword("") // Clear password when switching modes
  }

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h2 className="font-serif text-4xl font-light tracking-tight mb-2">
          {mode === "sign-in" ? "Continue to Dashboard" : "Get started"}
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          {mode === "sign-in" 
            ? "Sign in to access your account" 
            : "Create a new account"}
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
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "sign-in" && (
              <Link
                href="/auth/reset-password"
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={mode === "sign-in" ? "Enter your password" : "Create a password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
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
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {mode === "sign-up" && !error && (
            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters with letters and numbers
            </p>
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
              {mode === "sign-in" ? "Signing in..." : "Signing up..."}
            </>
          ) : (
            mode === "sign-in" ? "Continue to Dashboard" : "Sign up"
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-6">
        {mode === "sign-in" ? (
          <>
            Don't have an account?{" "}
            <button
              type="button"
              onClick={switchMode}
              className="underline hover:text-foreground font-medium"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Have an account?{" "}
            <button
              type="button"
              onClick={switchMode}
              className="underline hover:text-foreground font-medium"
            >
              Sign in
            </button>
          </>
        )}
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

      <Toaster />
    </div>
  )
}
