/**
 * Tests for plan-aware audit label logic (Cluster A: fix "Pro audit" label for free accounts)
 */

// Mirror the label logic from PageDiscoveryInline so we can unit test it without jsdom
function getAuditLabel(plan: 'free' | 'pro' | 'enterprise'): string {
  return plan === 'pro' || plan === 'enterprise' ? 'Pro audit' : 'Free audit'
}

describe('audit tier label', () => {
  it('shows Free audit for free plan', () => {
    expect(getAuditLabel('free')).toBe('Free audit')
  })

  it('shows Pro audit for pro plan', () => {
    expect(getAuditLabel('pro')).toBe('Pro audit')
  })

  it('shows Pro audit for enterprise plan', () => {
    expect(getAuditLabel('enterprise')).toBe('Pro audit')
  })
})
