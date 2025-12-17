"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase-browser"
import { Mic, FileText } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"

export function BrandVoiceSidebar() {
  const [guidelines, setGuidelines] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadGuidelines = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const response = await fetch('/api/guidelines?mode=list&limit=5', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setGuidelines(data.guidelines || [])
        }
      } catch (error) {
        console.error("Error loading guidelines:", error)
      } finally {
        setLoading(false)
      }
    }

    loadGuidelines()
  }, [])

  if (loading) {
    return null
  }

  if (guidelines.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Brand Voice">
                <Link href="/start">
                  <Mic className="h-4 w-4" />
                  <span>Brand Voice</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Brand Voice" disabled>
              <Mic className="h-4 w-4" />
              <span>Brand Voice</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {guidelines.map((guideline) => (
            <SidebarMenuItem key={guideline.id}>
              <SidebarMenuButton asChild tooltip={guideline.title || "Untitled"}>
                <Link href={`/guidelines/${guideline.id}`}>
                  <FileText className="h-4 w-4" />
                  <span>{guideline.title || "Untitled"}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

