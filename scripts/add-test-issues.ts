/**
 * Add test issues to an audit for testing the new dashboard and table
 * Usage: 
 *   pnpm tsx scripts/add-test-issues.ts <email> [auditId]
 *   pnpm tsx scripts/add-test-issues.ts l.gichigi@gmail.com
 *   pnpm tsx scripts/add-test-issues.ts l.gichigi@gmail.com <auditId>
 */

import { supabaseAdmin } from '../lib/supabase-admin'

const testIssues = [
  {
    title: "Fix typo: 'suport' → 'support'",
    category: "typos",
    severity: "medium" as const,
    impact: "Reduces credibility and professionalism",
    fix: "Change 'suport' to 'support'",
    locations: [
      { url: "https://example.com/contact", snippet: "Contact our suport team" }
    ]
  },
  {
    title: "Pricing conflict: $29 vs $39",
    category: "factual",
    severity: "high" as const,
    impact: "Confuses users about pricing",
    fix: "Standardize to one price",
    locations: [
      { url: "https://example.com/pricing", snippet: "Starting at $29/month" },
      { url: "https://example.com/features", snippet: "Plans start at $39/month" }
    ]
  },
  {
    title: "Add H1 tag",
    category: "seo",
    severity: "medium" as const,
    impact: "Hurts SEO and page structure",
    fix: "Add H1 tag with primary keyword",
    locations: [
      { url: "https://example.com/products", snippet: "Page has no H1 tag" }
    ]
  },
  {
    title: "Fix broken link: /old-page returns 404",
    category: "links",
    severity: "high" as const,
    impact: "Frustrates users and hurts SEO",
    fix: "Update URL or redirect to correct page",
    locations: [
      { url: "https://example.com/resources", snippet: "Link to /old-page returns 404" }
    ]
  },
  {
    title: "Missing alt text on hero image",
    category: "seo",
    severity: "low" as const,
    impact: "Hurts accessibility and SEO",
    fix: "Add descriptive alt text to image",
    locations: [
      { url: "https://example.com/home", snippet: "Hero image missing alt attribute" }
    ]
  },
  {
    title: "Inconsistent terminology: 'sign up' vs 'register'",
    category: "terminology",
    severity: "medium" as const,
    impact: "Confuses users and reduces brand consistency",
    fix: "Standardize to one term across all pages",
    locations: [
      { url: "https://example.com/login", snippet: "Click here to sign up" },
      { url: "https://example.com/account", snippet: "Register for an account" },
      { url: "https://example.com/pricing", snippet: "Register now" }
    ]
  },
  {
    title: "Fix grammar: 'your welcome' → 'you're welcome'",
    category: "grammar",
    severity: "low" as const,
    impact: "Reduces professionalism",
    fix: "Change 'your' to 'you're'",
    locations: [
      { url: "https://example.com/contact", snippet: "Your welcome to reach out" }
    ]
  },
  {
    title: "Missing meta description",
    category: "seo",
    severity: "medium" as const,
    impact: "Hurts SEO and social sharing",
    fix: "Add compelling meta description (150-160 chars)",
    locations: [
      { url: "https://example.com/about", snippet: "Page missing meta description tag" }
    ]
  },
  {
    title: "Outdated phone number: (555) 123-4567",
    category: "factual",
    severity: "high" as const,
    impact: "Users cannot contact support",
    fix: "Update to current phone number",
    locations: [
      { url: "https://example.com/contact", snippet: "Call us at (555) 123-4567" },
      { url: "https://example.com/footer", snippet: "Phone: (555) 123-4567" }
    ]
  }
]

async function findUserByEmail(email: string) {
  console.log(`Finding user with email: ${email}...`)
  
  const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
  if (listErr) {
    console.error('❌ Failed to list users:', listErr.message)
    throw new Error(`Failed to connect to database: ${listErr.message}`)
  }
  
  if (!usersData?.users || usersData.users.length === 0) {
    throw new Error('No users found in database. Please ensure the database is set up correctly.')
  }
  
  const authUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!authUser?.id) {
    console.error(`❌ User not found with email: ${email}`)
    console.error(`\nAvailable users (first 5):`)
    usersData.users.slice(0, 5).forEach((u, i) => {
      console.error(`  ${i + 1}. ${u.email || 'No email'}`)
    })
    throw new Error(`User not found with email: ${email}. Please check the email address and try again.`)
  }
  
  console.log(`✅ Found user: ${authUser.id}`)
  return authUser.id
}

async function findOrCreateAudit(userId: string, auditId?: string) {
  if (auditId) {
    // Verify audit exists and belongs to user
    const { data: audit, error: auditErr } = await supabaseAdmin
      .from('brand_audit_runs')
      .select('id, domain, created_at')
      .eq('id', auditId)
      .eq('user_id', userId)
      .maybeSingle()

    if (auditErr || !audit) {
      console.error('Audit not found or does not belong to user:', auditId)
      throw new Error('Audit not found')
    }
    
    console.log(`✅ Using existing audit: ${auditId} (domain: ${audit.domain || 'N/A'})`)
    return audit.id
  }
  
  // Find most recent audit for user
  const { data: audits, error: auditsErr } = await supabaseAdmin
    .from('brand_audit_runs')
    .select('id, domain, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  
  if (auditsErr) {
    console.error('❌ Error finding audits:', auditsErr.message)
    throw new Error(`Failed to query audits: ${auditsErr.message}`)
  }
  
  if (audits && audits.length > 0) {
    const audit = audits[0]
    console.log(`✅ Using most recent audit: ${audit.id} (domain: ${audit.domain || 'N/A'})`)
    return audit.id
  }
  
  // Create a new test audit
  console.log('⚠️  No existing audits found. Creating new test audit...')
  const { data: newAudit, error: createErr } = await supabaseAdmin
    .from('brand_audit_runs')
    .insert({
      user_id: userId,
      domain: 'example.com',
      pages_audited: 0,
      issues_json: { issues: [], auditedUrls: [] },
      is_preview: false,
    })
    .select('id')
    .single()
  
  if (createErr || !newAudit) {
    console.error('❌ Error creating test audit:', createErr?.message || 'Unknown error')
    throw new Error(`Failed to create test audit: ${createErr?.message || 'Unknown error'}. Please ensure the database migrations have been run.`)
  }
  
  console.log(`✅ Created new test audit: ${newAudit.id}`)
  return newAudit.id
}

async function addTestIssues(email: string, auditId?: string) {
  console.log(`\n📝 Adding ${testIssues.length} test issues...\n`)

  // Find user by email
  const userId = await findUserByEmail(email)
  
  // Find or create audit
  const finalAuditId = await findOrCreateAudit(userId, auditId)

  // Insert test issues
  const issuesToInsert = testIssues.map((issue) => ({
    audit_id: finalAuditId,
    title: issue.title,
    category: issue.category,
    severity: issue.severity,
    impact: issue.impact,
    fix: issue.fix,
    locations: issue.locations,
    status: 'active' as const,
  }))

  const { data, error } = await (supabaseAdmin as any)
    .from('issues')
    .insert(issuesToInsert)
    .select()

  if (error) {
    console.error('❌ Error inserting test issues:', error.message || error)
    if (error.code === '42P01') {
      throw new Error('Issues table not found. Please run database migrations first (017_create_issues_table.sql)')
    }
    throw new Error(`Failed to insert test issues: ${error.message || 'Unknown error'}`)
  }

  console.log(`\n✅ Successfully added ${data.length} test issues to audit ${finalAuditId}`)
  console.log('\n📋 Test issues added:')
  data.forEach((issue: any, idx: number) => {
    console.log(`  ${idx + 1}. ${issue.title} (${issue.severity})`)
  })
  console.log(`\n🔗 View in dashboard: /dashboard`)
  console.log(`   Audit ID: ${finalAuditId}\n`)
}

// Get email and optional audit ID from command line
const email = process.argv[2]
const auditId = process.argv[3]

if (!email) {
  console.error('Usage: pnpm tsx scripts/add-test-issues.ts <email> [auditId]')
  console.error('Example: pnpm tsx scripts/add-test-issues.ts l.gichigi@gmail.com')
  process.exit(1)
}

addTestIssues(email, auditId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message || error)
    process.exit(1)
  })

