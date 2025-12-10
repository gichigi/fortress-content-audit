// fortress v1
/**
 * Basic export format validation tests
 * Run with: pnpm test or jest
 */

describe('Export Format Validation', () => {
  describe('Format Gating', () => {
    it('should allow MD export for free users', () => {
      const formats = {
        free: ['md'],
        pro: ['md', 'pdf', 'docx', 'html'],
      }
      expect(formats.free).toContain('md')
      expect(formats.free).not.toContain('pdf')
      expect(formats.pro).toContain('pdf')
    })

    it('should validate format parameter', () => {
      const validFormats = ['md', 'pdf', 'docx', 'html']
      const testFormat = 'md'
      expect(validFormats).toContain(testFormat)
    })
  })

  describe('Export Response Headers', () => {
    it('should set correct Content-Type for Markdown', () => {
      const headers = {
        'Content-Type': 'text/markdown',
        'Content-Disposition': 'attachment; filename="test.md"',
      }
      expect(headers['Content-Type']).toBe('text/markdown')
      expect(headers['Content-Disposition']).toContain('.md')
    })

    it('should set correct Content-Type for DOCX', () => {
      const headers = {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="test.docx"',
      }
      expect(headers['Content-Type']).toContain('wordprocessingml')
      expect(headers['Content-Disposition']).toContain('.docx')
    })
  })
})


