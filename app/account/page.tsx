// fortress v1
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
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

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/sign-up?next=${encodeURIComponent('/account')}`)
        return
      }

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, plan, stripe_customer_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      setProfile({
        name: profileData?.name || null,
        email: session.user.email || null,
        plan: profileData?.plan || 'free'
      })

      setFormData({
        name: profileData?.name || "",
        email: session.user.email || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      console.error("Error loading profile:", error)
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Update name in profile
      if (formData.name !== profile?.name) {
        const { error } = await supabase
          .from('profiles')
          .update({ name: formData.name || null })
          .eq('user_id', session.user.id)

        if (error) throw error
      }

      // Update password if provided
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error("Passwords do not match")
        }

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
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpgrade = async () => {
    try {
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
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout",
        variant: "destructive"
      })
    }
  }

  const handleManageBilling = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to create portal session')

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open billing portal",
        variant: "destructive"
      })
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Delete user data
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', session.user.id)

      if (profileError) throw profileError

      // Sign out
      await supabase.auth.signOut()

      toast({
        title: "Account deleted",
        description: "Your account has been deleted"
      })

      router.push('/')
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive"
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
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                />
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
              <Button onClick={handleSaveProfile} disabled={saving || !formData.newPassword}>
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
                Current plan: <span className="font-medium">{PLAN_NAMES[profile?.plan as keyof typeof PLAN_NAMES] || 'Outpost'}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.plan === 'free' ? (
                <Button onClick={handleUpgrade} className="w-full">
                  Upgrade to {PLAN_NAMES.pro}
                </Button>
              ) : (
                <>
                  <Button onClick={handleManageBilling} variant="outline" className="w-full">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Manage Billing
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Cancel your subscription or update payment method in the billing portal
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


