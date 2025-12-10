"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { AuditResults } from "@/components/AuditResults"
import Header from "@/components/Header"
import { useParams } from "next/navigation"

export default function AuditDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [audit, setAudit] = useState<any>(null)
  
  useEffect(() => {
    loadAudit()
  }, [])

  const loadAudit = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/sign-up')
        return
      }

      const response = await fetch(`/api/audit/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load audit')
      }

      const data = await response.json()
      
      // Transform data to match what AuditResults expects
      // API returns { groups: [], meta: {}, domain: ... }
      // AuditResults expects { groups: [], meta: {}, totalIssues: number, preview: boolean }
      
      const formattedData = {
        ...data,
        totalIssues: data.groups.length,
        // Ensure preview is respected based on what API returns
        preview: data.preview
      }

      setAudit(formattedData)
    } catch (error) {
      console.error('Error loading audit:', error)
      toast({
        title: "Error",
        description: "Failed to load audit details",
        variant: "destructive"
      })
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleRerun = async () => {
    if (!audit?.domain) return
    
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/audit/${params.id}/rerun`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to rerun audit')
      }

      toast({
        title: "Audit started",
        description: "New audit is running..."
      })
      
      // Reload or redirect
      // Ideally wait for it to finish or poll, but for now just reload
      await loadAudit()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rerun audit",
        variant: "destructive"
      })
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="font-serif text-2xl font-medium">
              {audit?.title || audit?.brand_name || audit?.domain || 'Audit Details'}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleRerun}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Rerun Audit
          </Button>
        </div>

        {audit && (
          <AuditResults 
            results={audit} 
            isAuthenticated={true} 
          />
        )}
      </div>
    </div>
  )
}
