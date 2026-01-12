"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"
import { PLAN_NAMES, PLAN_PRICES, PLAN_FEATURES } from "@/lib/plans"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function PricingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
    }
    checkAuth()
  }, [])

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      router.push(`/sign-up?next=${encodeURIComponent('/pricing')}`)
      return
    }

    setCheckoutLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push(`/sign-up?next=${encodeURIComponent('/pricing')}`)
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
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-16 max-w-6xl">
        <div className="mb-16 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-light tracking-tight mb-4">
            Pricing
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Choose the plan that fits your content audit needs
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free Plan */}
          <Card className="border border-border flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="font-serif text-2xl font-semibold">
                  {PLAN_NAMES.free}
                </CardTitle>
                <Badge variant="outline">Free</Badge>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-light">${PLAN_PRICES.free}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription className="mt-4">
                Perfect for trying out content audits
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Homepage + 1 key page</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Language issues</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Facts & consistency</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Links & formatting</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Audit once per day</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">PDF, JSON, Markdown exports</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Track your content health</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">No credit card required</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full mt-auto" asChild>
                <Link href="/">Get Started</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="border-2 border-foreground flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="font-serif text-2xl font-semibold">
                  {PLAN_NAMES.pro}
                </CardTitle>
                <Badge>Pro</Badge>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-light">${PLAN_PRICES.pro}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription className="mt-4">
                For teams serious about content quality
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">10-20 key pages</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Enhanced audits</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Up to 5 domains</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Language issues</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Facts & consistency</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Links & formatting</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Audit once per day</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">PDF, JSON, Markdown exports</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Track your content health</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Auto weekly audits</span>
                </li>
              </ul>
              <Button 
                className="w-full mt-auto" 
                onClick={handleSubscribe}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : isAuthenticated ? (
                  "Subscribe"
                ) : (
                  "Sign up to subscribe"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className="border border-border flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="font-serif text-2xl font-semibold">
                  {PLAN_NAMES.enterprise}
                </CardTitle>
                <Badge variant="outline">Enterprise</Badge>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-light text-muted-foreground">Custom pricing</span>
              </div>
              <CardDescription className="mt-4">
                For organizations with advanced needs
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Enhanced audits</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Unlimited pages</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Unlimited domains</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Unlimited audits</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Language issues</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Facts & consistency</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Links & formatting</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">SEO issues and gaps</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Custom audit issues</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Daily email digests</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Autofix pull requests</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Slack/Teams integration</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">PDF, JSON, Markdown exports</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Track your content health</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <span className="text-sm">Auto weekly audits</span>
                </li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full mt-auto" 
                asChild
              >
                <a href="https://calendly.com/l-gichigi/customer-chat" target="_blank" rel="noopener noreferrer">
                  Book a call
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include secure payment processing via Stripe. Cancel anytime.
          </p>
        </div>
      </main>
    </div>
  )
}

