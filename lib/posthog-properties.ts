/**
 * PostHog Person Property Names
 * Use these constants to ensure consistency when referencing person properties
 * across the codebase or in PostHog filters/cohorts.
 */
export const POSTHOG_PERSON_PROPERTIES = {
  IS_INTERNAL: 'is_internal',
  USER_TYPE: 'user_type',
} as const

/**
 * User type values for person properties
 */
export const POSTHOG_USER_TYPES = {
  VISITOR: 'visitor',
  INTERNAL: 'internal',
  ADMIN: 'admin',
} as const

