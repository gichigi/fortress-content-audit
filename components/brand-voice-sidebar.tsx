"use client"

import { Mic } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function BrandVoiceSidebar() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              tooltip="Brand Voice - Coming Soon" 
              disabled
              className="cursor-not-allowed opacity-60"
            >
              <Mic className="h-4 w-4" />
              <span>Brand Voice</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                Coming Soon
              </Badge>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

