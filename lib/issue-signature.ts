import { createHash } from "crypto"
import { AuditIssueGroup } from "./audit-table-adapter"

/**
 * Normalize text for consistent signature generation
 * - Lowercase
 * - Trim whitespace
 * - Remove special characters (keep alphanumeric and spaces)
 * - Normalize whitespace (collapse multiple spaces to single space)
 */
export function normalizeIssueText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars, keep alphanumeric and spaces
    .replace(/\s+/g, " ") // Normalize whitespace
}

/**
 * Generate stable issue signature (SIS) for an audit issue GROUP (legacy)
 * 
 * Formula: SHA256(page_url + normalized_title)
 * 
 * This creates a deterministic hash that will be the same for the same issue
 * across multiple audits, enabling state persistence and suppression.
 * 
 * @deprecated Use generateInstanceSignature for new instance-based system
 * @param issue - Audit issue group with title and examples
 * @returns Hexadecimal string representation of SHA256 hash
 */
export function generateGroupSignature(issue: AuditIssueGroup): string {
  // Extract first example URL as page_url
  const pageUrl = issue.examples?.[0]?.url || ""
  
  // Normalize title for consistent hashing
  const normalizedTitle = normalizeIssueText(issue.title)
  
  // Combine page URL and normalized title
  const signatureInput = `${pageUrl}${normalizedTitle}`
  
  // Generate SHA256 hash
  const hash = createHash("sha256")
  hash.update(signatureInput)
  
  // Return hex string
  return hash.digest("hex")
}

/**
 * Generate stable issue signature (SIS) for an audit issue GROUP (backward compatibility)
 * 
 * @deprecated Use generateInstanceSignature for new instance-based system
 */
export function generateIssueSignature(issue: AuditIssueGroup): string {
  return generateGroupSignature(issue)
}

/**
 * Generate stable issue signature (SIS) for an audit issue INSTANCE
 * 
 * Formula: SHA256(url + normalized_title + normalized_snippet)
 * 
 * This creates a deterministic hash that will be the same for the same issue instance
 * across multiple audits, enabling granular state persistence and suppression.
 * 
 * @param instance - Audit issue instance with url, title, and snippet
 * @returns Hexadecimal string representation of SHA256 hash
 */
export function generateInstanceSignature(instance: {
  url: string
  title: string
  snippet: string
}): string {
  const url = instance.url || ""
  const normalizedTitle = normalizeIssueText(instance.title)
  const normalizedSnippet = normalizeIssueText(instance.snippet)
  
  // Combine url, normalized title, and normalized snippet
  const signatureInput = `${url}${normalizedTitle}${normalizedSnippet}`
  
  // Generate SHA256 hash
  const hash = createHash("sha256")
  hash.update(signatureInput)
  
  // Return hex string
  return hash.digest("hex")
}


