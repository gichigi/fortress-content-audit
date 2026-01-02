"use client"

import * as React from "react"
import { useState, Suspense, useEffect } from "react"
import { Loader2, Eye, EyeOff } from "lucide-react"
import type { AuthError } from "@supabase/supabase-js"
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

  // Rely on middleware for auth state management
  // Remove client-side session check to avoid security issues
  useEffect(() => {
    setIsCheckingAuth(false)
  }, [])

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validatePassword = (password: string) => {
    // Minimum 8 characters, at least one letter and one number
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  }

  // Centralized error message mapping for better UX
  // Handles both URL query params and Supabase AuthError objects
  const getAuthErrorMessage = (error: AuthError | Error | string | null): string => {
    // Handle URL query param errors
    if (typeof error === 'string') {
      const errorMap: Record<string, string> = {
        'invalid_reset_link': 'Your password reset link has expired or is invalid. Please request a new one.',
        'auth_failed': 'Authentication failed. Please try again.',
      }
      return errorMap[error] || 'Authentication failed. Please try again.'
    }
    
    // Handle null/undefined
    if (!error) {
      return 'Authentication failed. Please try again.'
    }
    
    // Handle AuthError or Error objects
    const message = error.message?.toLowerCase() || ''
    
    if (message.includes('email_not_confirmed') || message.includes('email not confirmed')) {
      return "Please check your email and confirm your account."
    }
    if (message.includes('invalid_credentials') || message.includes('invalid login credentials')) {
      return "Invalid email or password."
    }
    if (message.includes('user_already_registered') || message.includes('already registered')) {
      return "An account with this email already exists."
    }
    if (message.includes('oauth') || message.includes('provider')) {
      return "OAuth sign-in was cancelled or failed. Please try again."
    }
    
    return error.message || "Authentication failed. Please try again."
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
          throw new Error(getAuthErrorMessage(signInError))
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
          throw new Error(getAuthErrorMessage(signUpError))
        }
        
        // Check for duplicate email signup (user exists but no identities)
        if (!signUpData.session && signUpData.user?.identities?.length === 0) {
          // User already exists - prompt to sign in
          setError("An account with this email already exists. Please sign in instead.")
          setMode("sign-in")
          return
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
      const errorMessage = e instanceof Error ? getAuthErrorMessage(e) : "Authentication failed."
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError("")
    
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      
      if (error) {
        setError(getAuthErrorMessage(error))
        setLoading(false)
        toast({
          title: "Error",
          description: getAuthErrorMessage(error),
          variant: "destructive",
        })
      }
      // User will be redirected to Google, then back to callback
      // No need to set loading to false as redirect will happen
    } catch (e) {
      const errorMessage = e instanceof Error ? getAuthErrorMessage(e) : "OAuth sign-in failed. Please try again."
      setError(errorMessage)
      setLoading(false)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
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
            {getAuthErrorMessage(authError)}
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

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            or continue with
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </>
        )}
      </Button>

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

