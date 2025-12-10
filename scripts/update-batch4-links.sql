-- Manual link updates for remaining Batch 4 posts
-- Adds hub blockquotes and cross-link sentences with unique lead-ins

BEGIN;

-- Social media tone of voice examples
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'mastering-social-media-tone-of-voice-examples-and-insights'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This playbook pairs with our [Tone of Voice Marketing: Unifying Your Brand Across Every Touchpoint](https://aistyleguide.com/blog/tone-of-voice-marketing-unifying-your-brand-across-every-tou); use that blueprint to set channel-level guardrails before you remix voice cues for each platform conversation.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: storyboard your platform playbooks with [Crafting the Perfect Tone of Voice for Social Media: Platform-Specific Playbooks](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-for-social-media-platform) and pressure-test campaign messaging with [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: storyboard your platform playbooks with [Crafting the Perfect Tone of Voice for Social Media: Platform-Specific Playbooks](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-for-social-media-platform) and pressure-test campaign messaging with [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: storyboard your platform playbooks with [Crafting the Perfect Tone of Voice for Social Media: Platform-Specific Playbooks](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-for-social-media-platform) and pressure-test campaign messaging with [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'mastering-social-media-tone-of-voice-examples-and-insights';

-- Tone of voice in writing (email, web, social)
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'mastering-tone-of-voice-in-writing-email-web-and-social'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This playbook pairs with our [20 Tone of Voice Examples to Inspire Your Brand](https://aistyleguide.com/blog/20-tone-of-voice-examples-to-inspire-your-brand); tap those snapshots to anchor the examples you adapt for email, web, and social drafts.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: calibrate your channel playbooks with [Mastering Tone of Voice in Writing: Framework + Examples](https://aistyleguide.com/blog/mastering-tone-of-voice-in-writing-framework-examples) and workshop punchier copy with [Mastering Voice and Tone: Examples for Copywriters](https://aistyleguide.com/blog/mastering-voice-and-tone-examples-for-copywriters).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: calibrate your channel playbooks with [Mastering Tone of Voice in Writing: Framework + Examples](https://aistyleguide.com/blog/mastering-tone-of-voice-in-writing-framework-examples) and workshop punchier copy with [Mastering Voice and Tone: Examples for Copywriters](https://aistyleguide.com/blog/mastering-voice-and-tone-examples-for-copywriters).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: calibrate your channel playbooks with [Mastering Tone of Voice in Writing: Framework + Examples](https://aistyleguide.com/blog/mastering-tone-of-voice-in-writing-framework-examples) and workshop punchier copy with [Mastering Voice and Tone: Examples for Copywriters](https://aistyleguide.com/blog/mastering-voice-and-tone-examples-for-copywriters).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'mastering-tone-of-voice-in-writing-email-web-and-social';

-- Understanding brand voice: meaning and examples
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'understanding-brand-voice-meaning-and-examples'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This playbook pairs with our [Brand Voice 101: Building a Standout Voice That Sticks](https://aistyleguide.com/blog/brand-voice-101-building-a-standout-voice-that-sticks); start there to align teams on the fundamentals before you layer on meaning and examples.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: illustrate the concepts with [Brand Voice Examples: 12 Brands with Measurement Snapshots](https://aistyleguide.com/blog/brand-voice-examples-12-brands-with-measurement-snapshots) and run alignment drills from [Tone Alignment Labs: 6 Workshop Drills That Stick](https://aistyleguide.com/blog/tone-alignment-labs-6-workshop-drills-that-stick).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: illustrate the concepts with [Brand Voice Examples: 12 Brands with Measurement Snapshots](https://aistyleguide.com/blog/brand-voice-examples-12-brands-with-measurement-snapshots) and run alignment drills from [Tone Alignment Labs: 6 Workshop Drills That Stick](https://aistyleguide.com/blog/tone-alignment-labs-6-workshop-drills-that-stick).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: illustrate the concepts with [Brand Voice Examples: 12 Brands with Measurement Snapshots](https://aistyleguide.com/blog/brand-voice-examples-12-brands-with-measurement-snapshots) and run alignment drills from [Tone Alignment Labs: 6 Workshop Drills That Stick](https://aistyleguide.com/blog/tone-alignment-labs-6-workshop-drills-that-stick).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'understanding-brand-voice-meaning-and-examples';

-- Brand voice strategy: map traits to journeys
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'crafting-a-brand-voice-strategy-mapping-traits-to-customer-j'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This playbook pairs with our [Brand Voice 101: Building a Standout Voice That Sticks](https://aistyleguide.com/blog/brand-voice-101-building-a-standout-voice-that-sticks); use it to lock in core traits so this strategy map lands with every journey stage.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: operationalize the plan with [Mastering Brand Voice Consistency: A Governance Playbook](https://aistyleguide.com/blog/mastering-brand-voice-consistency-a-governance-playbook) and draft phased rollouts with [Crafting a Distinctive Brand Voice: A Comprehensive Roadmap](https://aistyleguide.com/blog/crafting-a-distinctive-brand-voice-a-comprehensive-roadmap).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: operationalize the plan with [Mastering Brand Voice Consistency: A Governance Playbook](https://aistyleguide.com/blog/mastering-brand-voice-consistency-a-governance-playbook) and draft phased rollouts with [Crafting a Distinctive Brand Voice: A Comprehensive Roadmap](https://aistyleguide.com/blog/crafting-a-distinctive-brand-voice-a-comprehensive-roadmap).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: operationalize the plan with [Mastering Brand Voice Consistency: A Governance Playbook](https://aistyleguide.com/blog/mastering-brand-voice-consistency-a-governance-playbook) and draft phased rollouts with [Crafting a Distinctive Brand Voice: A Comprehensive Roadmap](https://aistyleguide.com/blog/crafting-a-distinctive-brand-voice-a-comprehensive-roadmap).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'crafting-a-brand-voice-strategy-mapping-traits-to-customer-j';

-- Brand voice development roadmap
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'crafting-a-distinctive-brand-voice-a-comprehensive-roadmap'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This playbook pairs with our [Brand Voice 101: Building a Standout Voice That Sticks](https://aistyleguide.com/blog/brand-voice-101-building-a-standout-voice-that-sticks); revisit that primer as you build each phase of this roadmap with the right collaborators.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: assemble your enablement kit with [Mastering Brand Voice: Template Pack Essentials for Consistent Communication](https://aistyleguide.com/blog/mastering-brand-voice-template-pack-essentials-for-consisten) and [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: assemble your enablement kit with [Mastering Brand Voice: Template Pack Essentials for Consistent Communication](https://aistyleguide.com/blog/mastering-brand-voice-template-pack-essentials-for-consisten) and [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: assemble your enablement kit with [Mastering Brand Voice: Template Pack Essentials for Consistent Communication](https://aistyleguide.com/blog/mastering-brand-voice-template-pack-essentials-for-consisten) and [Tone Enablement Template: Crafting Role-Based Messaging Kits](https://aistyleguide.com/blog/tone-enablement-template-crafting-role-based-messaging-kits).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'crafting-a-distinctive-brand-voice-a-comprehensive-roadmap';

-- Choosing the right three words
UPDATE blog_posts
SET content = (
  WITH base AS (
    SELECT REPLACE(content, E'\\n', E'\n') AS body
    FROM blog_posts
    WHERE slug = 'choosing-the-right-3-words-for-your-brand-voice'
  ),
  without_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)> This playbook pairs with our \[[^\]]+\]\([^\)]+\); [^\n]+\n\n', '\1', 'g') AS body
    FROM base
  ),
  with_blockquote AS (
    SELECT REGEXP_REPLACE(body, E'(^# [^\n]+\n\n)', E'\\1> This playbook pairs with our [Brand Voice 101: Building a Standout Voice That Sticks](https://aistyleguide.com/blog/brand-voice-101-building-a-standout-voice-that-sticks); lean on it to align stakeholders before you commit to the three words that define your voice.\n\n', 1) AS body
    FROM without_blockquote
  ),
  without_next_steps AS (
    SELECT REGEXP_REPLACE(body, E'\n\nNext steps:.*$', '', 'g') AS body
    FROM with_blockquote
  ),
  final AS (
    SELECT CASE
      WHEN body LIKE '%\n\n## Conclusion%' THEN REPLACE(body, E'\n\n## Conclusion', E'\n\nNext steps: expand your trait toolkit with [8 Tone of Voice Types and How to Use Them Effectively](https://aistyleguide.com/blog/8-tone-of-voice-types-and-how-to-use-them-effectively) and score each option against [21 Types of Tone of Voice: Brand Archetypes & Scorecard Templates](https://aistyleguide.com/blog/21-types-of-tone-of-voice-brand-archetypes-scorecard-templat).\n\n## Conclusion')
      WHEN body LIKE '%\n\n---%' THEN REPLACE(body, E'\n\n---', E'\n\nNext steps: expand your trait toolkit with [8 Tone of Voice Types and How to Use Them Effectively](https://aistyleguide.com/blog/8-tone-of-voice-types-and-how-to-use-them-effectively) and score each option against [21 Types of Tone of Voice: Brand Archetypes & Scorecard Templates](https://aistyleguide.com/blog/21-types-of-tone-of-voice-brand-archetypes-scorecard-templat).\n\n---')
      ELSE TRIM(body) || E'\n\nNext steps: expand your trait toolkit with [8 Tone of Voice Types and How to Use Them Effectively](https://aistyleguide.com/blog/8-tone-of-voice-types-and-how-to-use-them-effectively) and score each option against [21 Types of Tone of Voice: Brand Archetypes & Scorecard Templates](https://aistyleguide.com/blog/21-types-of-tone-of-voice-brand-archetypes-scorecard-templat).'
    END AS body
    FROM without_next_steps
  )
  SELECT body FROM final
)
WHERE slug = 'choosing-the-right-3-words-for-your-brand-voice';

COMMIT;

-- Verification query
SELECT slug,
       LEFT(content, 200) AS first_200_chars,
       RIGHT(content, 200) AS last_200_chars,
       CASE WHEN content LIKE '%\n\nNext steps:%' THEN 'Has Next steps' ELSE 'Missing Next steps' END AS next_steps_status
FROM blog_posts
WHERE slug IN (
  'mastering-social-media-tone-of-voice-examples-and-insights',
  'mastering-tone-of-voice-in-writing-email-web-and-social',
  'understanding-brand-voice-meaning-and-examples',
  'crafting-a-brand-voice-strategy-mapping-traits-to-customer-j',
  'crafting-a-distinctive-brand-voice-a-comprehensive-roadmap',
  'choosing-the-right-3-words-for-your-brand-voice'
)
ORDER BY slug;
