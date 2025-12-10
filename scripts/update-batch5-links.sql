-- Manual link updates for Batch 5 posts
-- Mirrors Batch 4 helper but with unique blockquotes and Next steps sentences per plan

BEGIN;

-- 41. Tone of Voice in Marketing: Campaign Planning Checklist
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This article is part of our [Tone of Voice Marketing: Unifying Your Brand Across Every Touchpoint](https://aistyleguide.com/blog/tone-of-voice-marketing-unifying-your-brand-across-every-tou); use that roadmap to align metrics before you build this checklist.\n\n', 1) AS body
    FROM without_blockquote
  )
  SELECT body FROM with_blockquote
)
WHERE slug = 'crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec';

-- 44. Social Media Brand Voice: Keep Your Personality Consistent
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'mastering-social-media-brand-voice-consistency-is-key'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This article is part of our [Tone of Voice Marketing: Unifying Your Brand Across Every Touchpoint](https://aistyleguide.com/blog/tone-of-voice-marketing-unifying-your-brand-across-every-tou); keep it nearby so your engagement cadences stay rooted in the bigger brand promises.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: codify moderation rituals with [Tone Governance Playbook: Roles, Rituals, and Reviews](https://aistyleguide.com/blog/tone-governance-playbook-roles-rituals-and-reviews) and fine-tune replies with [Mastering Social Media Tone of Voice: Examples and Insights](https://aistyleguide.com/blog/mastering-social-media-tone-of-voice-examples-and-insights).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: codify moderation rituals with [Tone Governance Playbook: Roles, Rituals, and Reviews](https://aistyleguide.com/blog/tone-governance-playbook-roles-rituals-and-reviews) and fine-tune replies with [Mastering Social Media Tone of Voice: Examples and Insights](https://aistyleguide.com/blog/mastering-social-media-tone-of-voice-examples-and-insights).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: codify moderation rituals with [Tone Governance Playbook: Roles, Rituals, and Reviews](https://aistyleguide.com/blog/tone-governance-playbook-roles-rituals-and-reviews) and fine-tune replies with [Mastering Social Media Tone of Voice: Examples and Insights](https://aistyleguide.com/blog/mastering-social-media-tone-of-voice-examples-and-insights).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'mastering-social-media-brand-voice-consistency-is-key';

-- 45. Tone of Voice in Writing: Framework + Examples
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'mastering-tone-of-voice-in-writing-framework-examples'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This article is part of our [Tone of Voice Marketing: Unifying Your Brand Across Every Touchpoint](https://aistyleguide.com/blog/tone-of-voice-marketing-unifying-your-brand-across-every-tou); tap it to keep channel-specific edits aligned with the core tone decisions.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: compare rewrites in [Mastering Voice and Tone: Examples for Copywriters](https://aistyleguide.com/blog/mastering-voice-and-tone-examples-for-copywriters) and tighten review checkpoints with [Voice vs Brand Guidelines: Crafting Alignment & Conducting Audits](https://aistyleguide.com/blog/voice-vs-brand-guidelines-crafting-alignment-conducting-audi).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: compare rewrites in [Mastering Voice and Tone: Examples for Copywriters](https://aistyleguide.com/blog/mastering-voice-and-tone-examples-for-copywriters) and tighten review checkpoints with [Voice vs Brand Guidelines: Crafting Alignment & Conducting Audits](https://aistyleguide.com/blog/voice-vs-brand-guidelines-crafting-alignment-conducting-audi).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: compare rewrites in [Mastering Voice and Tone: Examples for Copywriters](https://aistyleguide.com/blog/mastering-voice-and-tone-examples-for-copywriters) and tighten review checkpoints with [Voice vs Brand Guidelines: Crafting Alignment & Conducting Audits](https://aistyleguide.com/blog/voice-vs-brand-guidelines-crafting-alignment-conducting-audi).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'mastering-tone-of-voice-in-writing-framework-examples';

-- 46. Tone of Voice in Emails: Templates for Every Scenario
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'mastering-tone-of-voice-in-emails-templates-for-every-scenar'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This article is part of our [Tone of Voice Marketing: Unifying Your Brand Across Every Touchpoint](https://aistyleguide.com/blog/tone-of-voice-marketing-unifying-your-brand-across-every-tou); use it to set expectations before you break emails into lifecycle tracks.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: audit personalization cues with [Tone Calibration Templates: Audit, Iterate, Localize](https://aistyleguide.com/blog/tone-calibration-templates-audit-iterate-localize) and kit out teams with [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: audit personalization cues with [Tone Calibration Templates: Audit, Iterate, Localize](https://aistyleguide.com/blog/tone-calibration-templates-audit-iterate-localize) and kit out teams with [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: audit personalization cues with [Tone Calibration Templates: Audit, Iterate, Localize](https://aistyleguide.com/blog/tone-calibration-templates-audit-iterate-localize) and kit out teams with [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'mastering-tone-of-voice-in-emails-templates-for-every-scenar';

-- 47. Tone of Voice in Advertising: Make Campaigns Feel On-Brand
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'mastering-tone-of-voice-in-advertising-ensuring-campaigns-al'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This article is part of our [Tone of Voice Marketing: Unifying Your Brand Across Every Touchpoint](https://aistyleguide.com/blog/tone-of-voice-marketing-unifying-your-brand-across-every-tou); let it ground campaign experiments so every ad still sounds like you.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: study winning copy in [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert) and re-use the briefing framework from [Crafting the Perfect Tone of Voice: A Marketing Campaign Checklist](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: study winning copy in [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert) and re-use the briefing framework from [Crafting the Perfect Tone of Voice: A Marketing Campaign Checklist](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: study winning copy in [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert) and re-use the briefing framework from [Crafting the Perfect Tone of Voice: A Marketing Campaign Checklist](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'mastering-tone-of-voice-in-advertising-ensuring-campaigns-al';

-- 48. How to Define Brand Voice in 5 Workshops
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'how-to-define-brand-voice-in-5-transformative-workshops'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This article is part of our [Brand Voice 101: Building a Standout Voice That Sticks](https://aistyleguide.com/blog/brand-voice-101-building-a-standout-voice-that-sticks); use it to anchor stakeholders before you run these workshops.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: warm up your sessions with [Tone Alignment Labs: 6 Workshop Drills That Stick](https://aistyleguide.com/blog/tone-alignment-labs-6-workshop-drills-that-stick) and package outputs with [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: warm up your sessions with [Tone Alignment Labs: 6 Workshop Drills That Stick](https://aistyleguide.com/blog/tone-alignment-labs-6-workshop-drills-that-stick) and package outputs with [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: warm up your sessions with [Tone Alignment Labs: 6 Workshop Drills That Stick](https://aistyleguide.com/blog/tone-alignment-labs-6-workshop-drills-that-stick) and package outputs with [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'how-to-define-brand-voice-in-5-transformative-workshops';

-- 49. Defining Brand Voice: Facilitator’s Guide
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'defining-brand-voice-a-facilitators-guide'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This article is part of our [Brand Voice 101: Building a Standout Voice That Sticks](https://aistyleguide.com/blog/brand-voice-101-building-a-standout-voice-that-sticks); keep it in view so every facilitation script ladders up to the shared voice pillars.\n\n', 1) AS body
    FROM without_blockquote
  )
  SELECT body FROM with_blockquote
)
WHERE slug = 'defining-brand-voice-a-facilitators-guide';

-- 50. Consistent Brand Voice: Governance Playbook
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'mastering-brand-voice-consistency-a-governance-playbook'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This article is part of our [Brand Voice 101: Building a Standout Voice That Sticks](https://aistyleguide.com/blog/brand-voice-101-building-a-standout-voice-that-sticks); lean on it to remind teams what \"on-voice\" means before you enforce new guardrails.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: align strategic guardrails with [Crafting a Brand Voice Strategy: Mapping Traits to Customer Journeys](https://aistyleguide.com/blog/crafting-a-brand-voice-strategy-mapping-traits-to-customer-j) and reinforce rituals in [Tone Governance Playbook: Roles, Rituals, and Reviews](https://aistyleguide.com/blog/tone-governance-playbook-roles-rituals-and-reviews).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: align strategic guardrails with [Crafting a Brand Voice Strategy: Mapping Traits to Customer Journeys](https://aistyleguide.com/blog/crafting-a-brand-voice-strategy-mapping-traits-to-customer-j) and reinforce rituals in [Tone Governance Playbook: Roles, Rituals, and Reviews](https://aistyleguide.com/blog/tone-governance-playbook-roles-rituals-and-reviews).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: align strategic guardrails with [Crafting a Brand Voice Strategy: Mapping Traits to Customer Journeys](https://aistyleguide.com/blog/crafting-a-brand-voice-strategy-mapping-traits-to-customer-j) and reinforce rituals in [Tone Governance Playbook: Roles, Rituals, and Reviews](https://aistyleguide.com/blog/tone-governance-playbook-roles-rituals-and-reviews).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'mastering-brand-voice-consistency-a-governance-playbook';

COMMIT;

-- Verification query
SELECT slug,
       LEFT(content, 200) AS first_200_chars,
       RIGHT(content, 200) AS last_200_chars,
       CASE WHEN content ~ E'\\n{2}Next steps:' THEN 'Has Next steps' ELSE 'Missing Next steps' END AS next_steps_status
FROM blog_posts
WHERE slug IN (
  'crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec',
  'mastering-social-media-brand-voice-consistency-is-key',
  'mastering-tone-of-voice-in-writing-framework-examples',
  'mastering-tone-of-voice-in-emails-templates-for-every-scenar',
  'mastering-tone-of-voice-in-advertising-ensuring-campaigns-al',
  'how-to-define-brand-voice-in-5-transformative-workshops',
  'defining-brand-voice-a-facilitators-guide',
  'mastering-brand-voice-consistency-a-governance-playbook'
)
ORDER BY slug;
