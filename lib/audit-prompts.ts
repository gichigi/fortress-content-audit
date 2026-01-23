/**
 * Inline Audit Prompts
 * Prompts for mini and full audits with manifest integration
 */

export function buildMiniAuditPrompt(
  url: string,
  manifestText: string,
  excludedIssues: string,
  activeIssues: string
): string {
  return `You are auditing ${url}. Below is an ELEMENT MANIFEST extracted from the actual HTML source code, showing all interactive elements (links, buttons, forms, headings) that exist on the page.

${manifestText}

---

Audit only the homepage and one additional key public-facing page of a website for language quality, factual accuracy, and functional links/formatting. In a single unified pass, audit both pages for all three content categories at once: Language, Facts & Consistency, and Links & Formatting. For each page, identify and log issues per category:

- Language (typos, grammar, spelling, punctuation)
- Facts & Consistency (factual errors, inconsistencies, incorrect stats)
- Links & Formatting (broken links, wrong destinations, confusing link text, formatting or layout problems)

**HOW TO USE THE MANIFEST:**

Use the manifest ONLY to avoid false positives about missing links/elements. The manifest shows code structure, NOT functionality.

**AUDIT THOROUGHLY:**
- Explore the site as you normally would (don't reduce exploration just because you have the manifest)
- Test ALL links by clicking them, even if they exist in the manifest (verify they WORK - no 404s, correct destinations)
- Open multiple pages to find issues across the site
- Use your full tool call allowance to be comprehensive

**Use manifest for:**
✓ Verifying if text is actually a link (avoid "plain text" false positives when manifest shows <a href="...">)
✓ Checking if headings are duplicated or legitimate (responsive designs may show same heading at different breakpoints)
✓ Understanding code structure to avoid reporting missing elements that actually exist

**DON'T use manifest as:**
✗ A reason to skip testing links (mailto links, external links, internal links all need testing)
✗ A reason to explore fewer pages
✗ A substitute for thorough auditing

**The manifest is a fact-checking tool, not a shortcut.** Audit with the same thoroughness as if you had no manifest.

If you encounter bot protection or a firewall blocking access to either page, immediately return the short string: BOT_PROTECTION_OR_FIREWALL_BLOCKED and stop the audit for that page.

If a page is still loading or temporarily unavailable, retry loading that page at least three times, with brief pauses in between. Do not skip the page due to delays until all retries have failed; only then skip that page and do not report issues for it.

For every issue found, provide an ultra-concise description. Format the issue description as follows:
- Start with a category-level impact or theme (e.g., "professionalism," "frustration," "trust," "confidence," "credibility") in lowercase, followed by a colon and a space.
- Then briefly state the problem, as clear and brief as possible (maximum one short sentence). Avoid unnecessary details.

After completing the single pass over both pages and categories, return as output:
- If any issues are found, return all issues as a JSON object per the required fields below.
- If no issues are found across any category or page, return the JSON null value (not an empty object, array, or any message).
- Summary fields:
    - total_issues: total number of issues found across both pages
    - pages_with_issues: number of unique pages on which issues were found (maximum 2)
    - pages_audited: total number of pages reviewed (maximum 2)

# Steps

1. For each of the two pages (homepage and one key additional public page), audit all three categories (Language; Facts & Consistency; Links & Formatting) in a single comprehensive review.
2. For every identified issue, generate a JSON object with required fields (see output format).
3. Ensure the "issue_description" begins with the appropriate impact keyword for instant clarity.
4. Track the total number of issues, count of pages with issues, and total pages audited.
5. If access to the homepage or the other audited page is blocked by a bot or firewall, immediately return only BOT_PROTECTION_OR_FIREWALL_BLOCKED (not JSON).
6. If a page fails to load after three retry attempts, skip that page and do not report issues for it.
7. If no issues are found in any category for either page, return null (the JSON null value).

# Output Format

If issues are found:
Respond with a JSON object containing:
- "issues": array of objects, each with:
    - page_url: [string]
    - category: [string] — must be "Language", "Facts & Consistency", or "Links & Formatting"
    - issue_description: [string] — begins with an impact word (e.g., "professionalism:", "frustration:", "trust:", "credibility:") then concise problem statement
    - severity: [string] — "critical", "medium", or "low"
    - suggested_fix: [string] — direct, actionable, concise fix
- "total_issues": [integer]
- "pages_with_issues": [integer] (maximum 2)
- "pages_audited": [integer] (maximum 2)

If no issues are found after reviewing both pages and all categories, return:
null

If access to either page is blocked by a bot or firewall, respond only with:
BOT_PROTECTION_OR_FIREWALL_BLOCKED

All fields must be as brief as possible without loss of clarity.

# Examples

Example if issues are found:

{
  "issues": [
    {
      "page_url": "https://example.com/home",
      "category": "Language",
      "issue_description": "professionalism: 'recieve' in the first line of the features section is misspelled—it should be 'receive.'",
      "severity": "low",
      "suggested_fix": "Correct spelling to 'receive.'"
    },
    {
      "page_url": "https://example.com/pricing",
      "category": "Links & Formatting",
      "issue_description": "frustration: the 'Contact Support' in the footer link leads to a broken page.",
      "severity": "critical",
      "suggested_fix": "Update link to the correct support page."
    }
  ],
  "total_issues": 2,
  "pages_with_issues": 2,
  "pages_audited": 2
}

Example if no issues are found:

null

# Notes

- Audit only the homepage and ONE key additional page, in a single comprehensive pass for all categories.
- Lead every "issue_description" with a one-word impact or theme for instant understanding.
- Severity must be "critical", "medium", or "low".
- "suggested_fix" should give a direct edit or change, extremely concise.
- Only count a page as a "page with issues" if at least one issue is found on it.
- "pages_audited" is the count of the pages actually checked (excluding pages skipped due to loading failure or bot/firewall block; maximum 2).
- If you encounter bot protection or firewall block on either page, immediately return only BOT_PROTECTION_OR_FIREWALL_BLOCKED (not JSON).
- If a page cannot load after three attempts, skip that page and log no issues for it.
- If no issues are found in any category for either page, return null (not an empty object, not an empty array, not any explanation).
- Use the precise output format above; do not include extraneous notes, explanations, or context.
- For each issue, be as specific as you can about its location. The user must be able to immediately find and identify the issue. Avoid vague descriptions.
- DON'T report "/cdn-cgi/l/email-protection" links as broken - Cloudflare decodes these client-side into valid mailto links.

**Important: Audit only the homepage and ONE key additional page. Audit all categories (Language, Facts & Consistency, Links & Formatting) in a single comprehensive pass (not three separate passes). If no issues are found, return null; otherwise, follow all formatting, style, and conciseness rules.**

${excludedIssues && excludedIssues !== '[]' ? `\n# Previously Resolved/Ignored Issues\n\nThe following issues have been resolved or ignored by the user. DO NOT report them again:\n${excludedIssues}\n` : ''}
${activeIssues && activeIssues !== '[]' ? `\n# Active Issues from Previous Audit\n\nThe following issues were found in a previous audit. Verify if they still exist:\n${activeIssues}\n` : ''}
`
}

export function buildFullAuditPrompt(
  url: string,
  manifestText: string,
  excludedIssues: string,
  activeIssues: string
): string {
  return `You are auditing ${url}. Below is an ELEMENT MANIFEST extracted from the actual HTML source code, showing all interactive elements (links, buttons, forms, headings) that exist on the page.

${manifestText}

---

Audit up to 20 public-facing, top-of-funnel pages of a website for:
- Language (typos, grammar, spelling, punctuation)
- Facts & Consistency (factual errors, inconsistencies, incorrect stats)
- Links & Formatting (broken links, wrong destinations, confusing link text, formatting/layout problems)

**HOW TO USE THE MANIFEST:**

Use the manifest ONLY to avoid false positives about missing links/elements. The manifest shows code structure, NOT functionality.

**AUDIT THOROUGHLY:**
- Explore the site as you normally would (don't reduce exploration just because you have the manifest)
- Test ALL links by clicking them, even if they exist in the manifest (verify they WORK - no 404s, correct destinations)
- Open multiple pages to find issues across the site
- Use your full tool call allowance to be comprehensive

**Use manifest for:**
✓ Verifying if text is actually a link (avoid "plain text" false positives when manifest shows <a href="...">)
✓ Checking if headings are duplicated or legitimate (responsive designs may show same heading at different breakpoints)
✓ Understanding code structure to avoid reporting missing elements that actually exist

**DON'T use manifest as:**
✗ A reason to skip testing links (mailto links, external links, internal links all need testing)
✗ A reason to explore fewer pages
✗ A substitute for thorough auditing

**The manifest is a fact-checking tool, not a shortcut.** Audit with the same thoroughness as if you had no manifest.

If you encounter bot protection or a firewall on any page, immediately return only: BOT_PROTECTION_OR_FIREWALL_BLOCKED and halt.

For pages that are still loading or temporarily unavailable, retry up to three times before skipping. Only consider pages fully loaded after all retries.

For every issue, log:
- page_url: [string]
- category: "Language", "Facts & Consistency", or "Links & Formatting"
- issue_description: Begins with a one-word impact/theme (e.g., "professionalism:", "frustration:", "trust:", "credibility:") in lowercase, followed by an ultra-concise, one-sentence problem statement.
- severity: "critical", "medium", or "low"
- suggested_fix: Direct, actionable, extremely concise fix

Output:
- If issues are found: JSON object with all issues, plus
    - total_issues: number of issues across all pages
    - pages_with_issues: number of unique pages with at least one issue
    - pages_audited: count of pages successfully reviewed (exclude skipped or blocked pages)
- If no issues are found: return the JSON null value (exactly null).
- If a page is blocked by a bot or firewall: immediately return only BOT_PROTECTION_OR_FIREWALL_BLOCKED.
- If a page cannot load after three attempts: skip it; do not log issues for that page.

Be concise but clear in all fields.

# Output Format

If issues are found, respond with:
{
  "issues": [
    {
      "page_url": "[string]",
      "category": "[Language|Facts & Consistency|Links & Formatting]",
      "issue_description": "[impact word]: [ultra-concise problem statement]",
      "severity": "[critical|medium|low]",
      "suggested_fix": "[concise fix]"
    }
    // ...more issues as needed
  ],
  "total_issues": [integer],
  "pages_with_issues": [integer],
  "pages_audited": [integer]
}

If no issues are found, respond with:
null

# Examples

Example if issues are found:
{
  "issues": [
    {
      "page_url": "https://example.com/home",
      "category": "Language",
      "issue_description": "professionalism: 'recieve' in the features section is misspelled—it should be 'receive.'",
      "severity": "low",
      "suggested_fix": "Correct spelling to 'receive.'"
    },
    {
      "page_url": "https://example.com/about",
      "category": "Links & Formatting",
      "issue_description": "frustration: the 'Contact Us' in the footer link leads to a 404 error.",
      "severity": "critical",
      "suggested_fix": "Update link to correct contact page."
    },
    {
      "page_url": "https://example.com/pricing",
      "category": "Links & Formatting",
      "issue_description": "trust: 'Learn More' button in hero banner links to homepage instead of pricing.",
      "severity": "medium",
      "suggested_fix": "Change button link to pricing details."
    }
  ],
  "total_issues": 3,
  "pages_with_issues": 3,
  "pages_audited": 10
}

Example if no issues are found:
null

# Notes

- Lead every issue_description with a one-word impact or theme.
- Only "critical", "medium", or "low" are valid for severity.
- "suggested_fix" should be an extremely concise edit or change.
- Only count a page as "with issues" if at least one issue is on it.
- Do not count skipped or blocked pages in pages_audited.
- Never include extra notes, explanations, or context outside the specified JSON or null/null-string outputs.
- For each issue, be as specific as you can about its location. The user must be able to immediately find and identify the issue. Avoid vague descriptions.
- DON'T report "/cdn-cgi/l/email-protection" links as broken - Cloudflare decodes these client-side into valid mailto links.

Reminder: Always condense instructions, return outputs in the precise format, and avoid redundant or unnecessary information.

${excludedIssues && excludedIssues !== '[]' ? `\n# Previously Resolved/Ignored Issues\n\nThe following issues have been resolved or ignored by the user. DO NOT report them again:\n${excludedIssues}\n` : ''}
${activeIssues && activeIssues !== '[]' ? `\n# Active Issues from Previous Audit\n\nThe following issues were found in a previous audit. Verify if they still exist:\n${activeIssues}\n` : ''}
`
}
