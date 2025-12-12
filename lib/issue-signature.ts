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
 * Generate stable issue signature (SIS) for an audit issue
 * 
 * Formula: SHA256(page_url + normalized_title)
 * 
 * This creates a deterministic hash that will be the same for the same issue
 * across multiple audits, enabling state persistence and suppression.
 * 
 * @param issue - Audit issue group with title and examples
 * @returns Hexadecimal string representation of SHA256 hash
 */
export function generateIssueSignature(issue: AuditIssueGroup): string {
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

