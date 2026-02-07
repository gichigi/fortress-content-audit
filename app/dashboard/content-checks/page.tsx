"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

// Redirect to Audit options (audit-options) with same domain
export default function ContentChecksRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const domain = searchParams.get("domain")

  useEffect(() => {
    const url = domain
      ? `/dashboard/audit-options?domain=${encodeURIComponent(domain)}`
      : "/dashboard"
    router.replace(url)
  }, [domain, router])

  return null
}
