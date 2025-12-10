// Renderer to convert validated JSON rules to markdown format

import { StyleRule } from './rules-schema';

/**
 * Render an array of style rules to markdown format
 * Format: ### N. Title
 *         Description line
 *         ✅ Good example
 *         ❌ Bad example
 */
export function renderRulesMarkdown(rules: StyleRule[]): string {
  if (!rules || rules.length === 0) {
    return '';
  }

  return rules
    .map((rule, index) => {
      const number = index + 1;
      const lines = [
        `### ${number}. ${rule.title}`,
        rule.description,
        `✅ ${rule.examples.good}`,
        `❌ ${rule.examples.bad}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}

