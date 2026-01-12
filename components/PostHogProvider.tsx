"use client"

import { useEffect } from "react"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { POSTHOG_PERSON_PROPERTIES, POSTHOG_USER_TYPES } from "@/lib/posthog-properties"

interface PostHogProviderProps {
  children: React.ReactNode
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Skip PostHog initialization in development or if key is missing
    if (process.env.NODE_ENV === "development" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      console.log('[PostHog] Skipping initialization in development mode or missing key')
      return
    }

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      capture_exceptions: false, // Disable exception capture to prevent console errors
      debug: false,
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug()
      },
    })

    // PostHog identification and user setup
    const identifyUser = () => {
      const isInternal = localStorage.getItem('posthog_internal') === 'true'

      if (isInternal) {
        const customId = localStorage.getItem('posthog_user_id')
        const userId = customId && !customId.includes('your-email@example.com')
          ? customId
          : `internal-${Date.now()}`

        console.log('[PostHog] Identifying internal user:', userId)
        posthog.identify(userId, {
          [POSTHOG_PERSON_PROPERTIES.IS_INTERNAL]: true,
          [POSTHOG_PERSON_PROPERTIES.USER_TYPE]: localStorage.getItem('posthog_user_type') || POSTHOG_USER_TYPES.VISITOR,
        })
      }
    }

    setTimeout(identifyUser, 100)
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
