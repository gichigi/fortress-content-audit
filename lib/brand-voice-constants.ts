/**
 * Brand voice configuration constants, enums, and validation schemas.
 * Used by: app/api/brand-voice/*, app/dashboard/* pages
 */

import { z } from "zod"

// ============================================================================
// ENUM VALUES - Must match expected options across the system
// ============================================================================

export const VALID_READABILITY = ["grade_6_8", "grade_10_12", "grade_13_plus"] as const
export const VALID_FORMALITY = ["very_casual", "casual", "neutral", "formal", "very_formal"] as const
export const VALID_LOCALE = ["en-US", "en-GB"] as const

export type ReadabilityLevel = (typeof VALID_READABILITY)[number]
export type Formality = (typeof VALID_FORMALITY)[number]
export type Locale = (typeof VALID_LOCALE)[number]

// ============================================================================
// SIZE LIMITS
// ============================================================================

export const MAX_VOICE_SUMMARY = 10000 // ~2000 words
export const MAX_KEYWORDS = 50 // per array (flag or ignore)
export const MAX_KEYWORD_LENGTH = 100 // per keyword
export const MAX_DOMAIN_LENGTH = 253 // DNS spec

// ============================================================================
// DOMAIN VALIDATION
// ============================================================================

// RFC 1123 domain format: labels separated by dots, each 1-63 chars, total 253 chars
// Simplified regex that handles most valid domains
export const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > MAX_DOMAIN_LENGTH) return false
  return DOMAIN_REGEX.test(domain)
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const BrandVoiceProfileSchema = z.object({
  domain: z.string().refine((d) => isValidDomain(d), {
    message: "Invalid domain format",
  }),
  enabled: z.boolean().optional(),
  readability_level: z.enum([...VALID_READABILITY, ""] as const).transform((v) => v || null),
  formality: z.enum([...VALID_FORMALITY, ""] as const).transform((v) => v || null),
  locale: z.enum([...VALID_LOCALE, ""] as const).transform((v) => v || null),
  flag_keywords: z
    .array(z.string().max(MAX_KEYWORD_LENGTH))
    .max(MAX_KEYWORDS)
    .default([]),
  ignore_keywords: z
    .array(z.string().max(MAX_KEYWORD_LENGTH))
    .max(MAX_KEYWORDS)
    .default([]),
  voice_summary: z.string().max(MAX_VOICE_SUMMARY).nullable().optional(),
  flag_ai_writing: z.boolean().optional(),
  include_longform_full_audit: z.boolean().optional(),
  source: z.string().optional(),
  source_domain: z.string().nullable().optional(),
  source_pages: z.array(z.string()).nullable().optional(),
  source_summary: z.string().nullable().optional(),
  generated_at: z.string().nullable().optional(),
})

export type BrandVoiceProfile = z.infer<typeof BrandVoiceProfileSchema>
