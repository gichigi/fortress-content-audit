// fortress v1
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Loader2, CreditCard, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PLAN_NAMES } from "@/lib/plans"

export default function AccountPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [profile, setProfile] = useState<{
    name: string | null
    email: string | null
    plan: string
  } | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    loadProfile()
  }, [])

  // Reload profile when returning from Stripe checkout (payment success)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('payment') === 'success') {
      // Reload profile to get updated plan
      loadProfile()
      toast({
        title: "Payment successful!",
        description: "Your subscription is now active.",
      })
      // Clear query param
      router.replace('/account', { scroll: false })
    }
  }, [router, toast])

  const loadProfile = async () => {
    try {
      const supabase = createClient()
      // Use getUser() instead of getSession() for security (validates with server)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        router.push(`/sign-up?next=${encodeURIComponent('/account')}`)
        return
      }

      // Get session for access token if needed
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/sign-up?next=${encodeURIComponent('/account')}`)
        return
      }

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, plan, stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle()

      setProfile({
        name: profileData?.name || null,
        email: user.email || null,
        plan: profileData?.plan || 'free'
      })

      setFormData({
        name: profileData?.name || "",
        email: user.email || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      console.error("Error loading profile:", error)
      toast({
        title: "Unable to load profile",
        description: "Please refresh the page to try again.",
        variant: "error",
      })
    } finally {
      setLoading(false)
    }
  }

  const validatePassword = (password: string) => {
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Update name in profile
      if (formData.name !== profile?.name) {
        const { error } = await supabase
          .from('profiles')
          .update({ name: formData.name || null })
          .eq('user_id', user.id)

        if (error) throw error
      }

      // Update password if provided
      if (formData.newPassword) {
        // Validate password format
        if (!validatePassword(formData.newPassword)) {
          throw new Error("Password must be at least 8 characters and include both letters and numbers")
        }

        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error("Passwords do not match")
        }

        // Verify current password before allowing change
        if (!formData.currentPassword) {
          throw new Error("Current password is required to change your password")
        }

        // Verify current password by attempting sign-in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: formData.currentPassword
        })

        if (signInError) {
          throw new Error("Current password is incorrect")
        }

        // Update password
        const { error } = await supabase.auth.updateUser({
          password: formData.newPassword
        })

        if (error) throw error
      }

      toast({
        title: "Saved",
        description: "Profile updated successfully"
      })

      await loadProfile()
      setFormData(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }))
    } catch (error) {
      toast({
        title: "Unable to update profile",
        description: error instanceof Error ? error.message : "Please try again or contact support if the issue persists.",
        variant: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpgrade = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/sign-up?next=${encodeURIComponent('/account')}`)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/sign-up?next=${encodeURIComponent('/account')}`)
        return
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      toast({
        title: "Unable to start checkout",
        description: error instanceof Error ? error.message : "Please try again or contact support if the issue persists.",
        variant: "error",
      })
    }
  }

  const handleManageBilling = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to create portal session (${response.status})`)
      }

      const { url } = await response.json()
      if (!url) {
        throw new Error('No portal URL returned')
      }
      
      window.location.href = url
    } catch (error) {
      console.error('[Account] Error opening billing portal:', error)
      toast({
        title: "Unable to open billing portal",
        description: error instanceof Error ? error.message : "Please try again or contact support if the issue persists.",
        variant: "error",
      })
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: "Please sign in",
          description: "You must be logged in to delete your account.",
        })
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({
          title: "Session expired",
          description: "Please sign in again to continue.",
        })
        return
      }

      // Call API endpoint to delete account
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to delete account (${response.status})`)
      }

      // Sign out locally
      await supabase.auth.signOut()

      toast({
        title: "Account deleted",
        description: "Your account has been deleted"
      })

      router.push('/')
    } catch (error) {
      toast({
        title: "Unable to delete account",
        description: error instanceof Error ? error.message : "Please try again or contact support if the issue persists.",
        variant: "error",
      })
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-16 max-w-4xl">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-16 max-w-4xl">
        <div className="mb-12">
          <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Link>
          <h1 className="font-serif text-5xl md:text-6xl font-light tracking-tight mb-4">
            Account
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
            Manage your profile, billing, and account settings
          </p>
        </div>

        <div className="space-y-8">
          {/* Profile Section */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-serif text-2xl font-semibold">Profile</CardTitle>
              <CardDescription>Update your name and email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if you need to update it.
                </p>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Password Section */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-serif text-2xl font-semibold">Password</CardTitle>
              <CardDescription>Change your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Enter your current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters and include both letters and numbers
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving || !formData.newPassword || !formData.currentPassword}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Billing Section */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="font-serif text-2xl font-semibold">Billing</CardTitle>
              <CardDescription>
                Current plan: <span className="font-medium">{PLAN_NAMES[profile?.plan as keyof typeof PLAN_NAMES] || 'Tier 1'}</span>
                {profile?.plan === 'free' && <span className="text-muted-foreground"> (free)</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.plan === 'free' ? (
                <div className="flex gap-3">
                  <Button onClick={handleUpgrade} className="flex-1">
                    Upgrade to {PLAN_NAMES.pro}
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/pricing">View Pricing</Link>
                  </Button>
                </div>
              ) : profile?.plan === 'pro' ? (
                <div className="flex gap-3">
                  <Button asChild className="flex-1">
                    <Link href="/pricing">Upgrade to {PLAN_NAMES.enterprise}</Link>
                  </Button>
                  <Button onClick={handleManageBilling} variant="outline" className="flex-1">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Billing
                  </Button>
                </div>
              ) : (
                <>
                  <Button onClick={handleManageBilling} variant="outline" className="w-full">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Cancel Subscription
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Contact us to cancel your enterprise subscription
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive border-2">
            <CardHeader>
              <CardTitle className="font-serif text-2xl font-semibold text-destructive">Danger Zone</CardTitle>
              <CardDescription>Permanently delete your account and all data</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your account, guidelines, and audit data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Account"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}


