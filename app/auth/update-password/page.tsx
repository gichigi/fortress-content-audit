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
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    // Check if user has a valid session (from password reset link)
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push("/sign-up?error=invalid_reset_link")
      }
    }
    
    checkSession()
  }, [router])

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
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard")
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password.")
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update password.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <nav className="container mx-auto px-6 py-6">
          <Link href="/" className="text-2xl font-serif font-semibold tracking-tight">
            Fortress
          </Link>
        </nav>
      </header>
      
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

