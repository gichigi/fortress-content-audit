import { classifyError, extractPagesAudited } from '../error-classifier';

describe('Error Classifier', () => {
  describe('classifyError', () => {
    it('should classify bot protection errors', () => {
      const result = classifyError('Bot protection detected');
      expect(result.type).toBe('bot_protection');
      expect(result.message).toBe('Website has bot protection enabled');
    });

    it('should classify Cloudflare as bot protection', () => {
      const result = classifyError('Blocked by Cloudflare firewall');
      expect(result.type).toBe('bot_protection');
    });

    it('should classify timeout errors', () => {
      const result = classifyError('Request timed out after 5 minutes');
      expect(result.type).toBe('timeout');
      expect(result.message).toBe('Audit took longer than expected');
    });

    it('should include pages audited for timeout errors', () => {
      const result = classifyError('Timed out', { pagesAudited: 5 });
      expect(result.type).toBe('timeout');
      expect(result.pagesAudited).toBe(5);
    });

    it('should classify network errors', () => {
      const result = classifyError('Network connection lost');
      expect(result.type).toBe('network_error');
      expect(result.message).toBe('Lost connection during audit');
    });

    it('should classify validation errors', () => {
      const result = classifyError('Invalid domain format');
      expect(result.type).toBe('validation');
      expect(result.message).toBe('Invalid request');
    });

    it('should classify unknown errors as api_error', () => {
      const result = classifyError('Something went wrong');
      expect(result.type).toBe('api_error');
      expect(result.message).toBe('Something went wrong');
    });

    it('should handle empty error messages', () => {
      const result = classifyError('');
      expect(result.type).toBe('api_error');
      expect(result.message).toBe('An unexpected error occurred');
    });

    it('should be case-insensitive', () => {
      const result = classifyError('CLOUDFLARE BLOCKED');
      expect(result.type).toBe('bot_protection');
    });

    it('should classify rate limit errors', () => {
      const result = classifyError('You have reached your daily limit');
      expect(result.type).toBe('rate_limit');
      expect(result.message).toBe('Daily audit limit reached');
    });

    it('should classify 429 errors as rate limit', () => {
      const result = classifyError('429 - Too many requests');
      expect(result.type).toBe('rate_limit');
    });
  });

  describe('extractPagesAudited', () => {
    it('should extract page count from error message', () => {
      const count = extractPagesAudited('Audited 5 pages before timeout');
      expect(count).toBe(5);
    });

    it('should handle plural pages', () => {
      const count = extractPagesAudited('Completed 10 pages');
      expect(count).toBe(10);
    });

    it('should handle singular page', () => {
      const count = extractPagesAudited('Only 1 page was processed');
      expect(count).toBe(1);
    });

    it('should return undefined if no page count found', () => {
      const count = extractPagesAudited('No pages mentioned');
      expect(count).toBeUndefined();
    });
  });
});
