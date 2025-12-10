-- Fix four blog posts with literal \n sequences and ensure proper Next steps formatting
-- Run this transaction in Supabase SQL editor or psql
--
-- This script:
-- 1. Replaces literal "\n" sequences with actual newlines
-- 2. Removes any existing "Next steps:" sentences
-- 3. Appends the correct "Next steps:" sentence for each post

BEGIN;

-- Helper function to clean content and add Next steps
-- For each post: replace \n, remove old Next steps, add new Next steps before Conclusion/--- or at end

-- 1. marketing-tone-of-voice-examples-that-convert
UPDATE blog_posts
SET content = (
  -- Step 1: Replace literal \n with actual newlines
  -- Step 2: Remove any existing "Next steps:" sentences
  -- Step 3: Add "Next steps:" before ## Conclusion, ---, or at end
  WITH step1 AS (
    SELECT REPLACE(content, E'\\n', E'\n') as cleaned
    FROM blog_posts
    WHERE slug = 'marketing-tone-of-voice-examples-that-convert'
  ),
  step2 AS (
    SELECT REGEXP_REPLACE(cleaned, E'\n\nNext steps:.*$', '', 'g') as no_next_steps
    FROM step1
  ),
  step3 AS (
    SELECT 
      CASE
        WHEN no_next_steps LIKE '%\n\n## Conclusion%' THEN
          REPLACE(no_next_steps, E'\n\n## Conclusion', E'\n\nNext steps: explore [Aligning Tone of Voice with Marketing KPIs for Consistent Campaign Success](https://aistyleguide.com/blog/aligning-tone-of-voice-with-marketing-kpis-for-consistent-ca) and [Tone of Voice in Marketing: Campaign Planning Checklist](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec).\n\n## Conclusion')
        WHEN no_next_steps LIKE '%\n\n---%' THEN
          REPLACE(no_next_steps, E'\n\n---', E'\n\nNext steps: explore [Aligning Tone of Voice with Marketing KPIs for Consistent Campaign Success](https://aistyleguide.com/blog/aligning-tone-of-voice-with-marketing-kpis-for-consistent-ca) and [Tone of Voice in Marketing: Campaign Planning Checklist](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec).\n\n---')
        ELSE
          TRIM(no_next_steps) || E'\n\nNext steps: explore [Aligning Tone of Voice with Marketing KPIs for Consistent Campaign Success](https://aistyleguide.com/blog/aligning-tone-of-voice-with-marketing-kpis-for-consistent-ca) and [Tone of Voice in Marketing: Campaign Planning Checklist](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-a-marketing-campaign-chec).'
      END as final
    FROM step2
  )
  SELECT final FROM step3
)
WHERE slug = 'marketing-tone-of-voice-examples-that-convert';

-- 2. mailchimp-tone-of-voice-lessons-from-a-saas-favorite
UPDATE blog_posts
SET content = (
  WITH step1 AS (
    SELECT REPLACE(content, E'\\n', E'\n') as cleaned
    FROM blog_posts
    WHERE slug = 'mailchimp-tone-of-voice-lessons-from-a-saas-favorite'
  ),
  step2 AS (
    SELECT REGEXP_REPLACE(cleaned, E'\n\nNext steps:.*$', '', 'g') as no_next_steps
    FROM step1
  ),
  step3 AS (
    SELECT 
      CASE
        WHEN no_next_steps LIKE '%\n\n## Conclusion%' THEN
          REPLACE(no_next_steps, E'\n\n## Conclusion', E'\n\nNext steps: explore [Tone of Voice for Social Media: Playbooks by Platform](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-for-social-media-platform) and [Consistent Brand Voice: Governance Playbook](https://aistyleguide.com/blog/mastering-brand-voice-consistency-a-governance-playbook).\n\n## Conclusion')
        WHEN no_next_steps LIKE '%\n\n---%' THEN
          REPLACE(no_next_steps, E'\n\n---', E'\n\nNext steps: explore [Tone of Voice for Social Media: Playbooks by Platform](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-for-social-media-platform) and [Consistent Brand Voice: Governance Playbook](https://aistyleguide.com/blog/mastering-brand-voice-consistency-a-governance-playbook).\n\n---')
        ELSE
          TRIM(no_next_steps) || E'\n\nNext steps: explore [Tone of Voice for Social Media: Playbooks by Platform](https://aistyleguide.com/blog/crafting-the-perfect-tone-of-voice-for-social-media-platform) and [Consistent Brand Voice: Governance Playbook](https://aistyleguide.com/blog/mastering-brand-voice-consistency-a-governance-playbook).'
      END as final
    FROM step2
  )
  SELECT final FROM step3
)
WHERE slug = 'mailchimp-tone-of-voice-lessons-from-a-saas-favorite';

-- 3. mastering-voice-and-tone-examples-for-copywriters
UPDATE blog_posts
SET content = (
  WITH step1 AS (
    SELECT REPLACE(content, E'\\n', E'\n') as cleaned
    FROM blog_posts
    WHERE slug = 'mastering-voice-and-tone-examples-for-copywriters'
  ),
  step2 AS (
    SELECT REGEXP_REPLACE(cleaned, E'\n\nNext steps:.*$', '', 'g') as no_next_steps
    FROM step1
  ),
  step3 AS (
    SELECT 
      CASE
        WHEN no_next_steps LIKE '%\n\n## Conclusion%' THEN
          REPLACE(no_next_steps, E'\n\n## Conclusion', E'\n\nNext steps: explore [Tone of Voice in Writing: Framework + Examples](https://aistyleguide.com/blog/mastering-tone-of-voice-in-writing-framework-examples) and [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert) to stress-test your copy in different contexts.\n\n## Conclusion')
        WHEN no_next_steps LIKE '%\n\n---%' THEN
          REPLACE(no_next_steps, E'\n\n---', E'\n\nNext steps: explore [Tone of Voice in Writing: Framework + Examples](https://aistyleguide.com/blog/mastering-tone-of-voice-in-writing-framework-examples) and [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert) to stress-test your copy in different contexts.\n\n---')
        ELSE
          TRIM(no_next_steps) || E'\n\nNext steps: explore [Tone of Voice in Writing: Framework + Examples](https://aistyleguide.com/blog/mastering-tone-of-voice-in-writing-framework-examples) and [Marketing Tone of Voice Examples That Convert](https://aistyleguide.com/blog/marketing-tone-of-voice-examples-that-convert) to stress-test your copy in different contexts.'
      END as final
    FROM step2
  )
  SELECT final FROM step3
)
WHERE slug = 'mastering-voice-and-tone-examples-for-copywriters';

-- 4. why-nikes-find-your-greatness-resonates
UPDATE blog_posts
SET content = (
  WITH step1 AS (
    SELECT REPLACE(content, E'\\n', E'\n') as cleaned
    FROM blog_posts
    WHERE slug = 'why-nikes-find-your-greatness-resonates'
  ),
  step2 AS (
    SELECT REGEXP_REPLACE(cleaned, E'\n\nNext steps:.*$', '', 'g') as no_next_steps
    FROM step1
  ),
  step3 AS (
    SELECT 
      CASE
        WHEN no_next_steps LIKE '%\n\n## Conclusion%' THEN
          REPLACE(no_next_steps, E'\n\n## Conclusion', E'\n\nNext steps: explore [Brand Voice Examples: 12 Brands with Measurement Snapshots](https://aistyleguide.com/blog/brand-voice-examples-12-brands-with-measurement-snapshots) and [Crafting Brand Voice Guidelines: A Step-by-Step Framework](https://aistyleguide.com/blog/crafting-brand-voice-guidelines-a-step-by-step-framework).\n\n## Conclusion')
        WHEN no_next_steps LIKE '%\n\n---%' THEN
          REPLACE(no_next_steps, E'\n\n---', E'\n\nNext steps: explore [Brand Voice Examples: 12 Brands with Measurement Snapshots](https://aistyleguide.com/blog/brand-voice-examples-12-brands-with-measurement-snapshots) and [Crafting Brand Voice Guidelines: A Step-by-Step Framework](https://aistyleguide.com/blog/crafting-brand-voice-guidelines-a-step-by-step-framework).\n\n---')
        ELSE
          TRIM(no_next_steps) || E'\n\nNext steps: explore [Brand Voice Examples: 12 Brands with Measurement Snapshots](https://aistyleguide.com/blog/brand-voice-examples-12-brands-with-measurement-snapshots) and [Crafting Brand Voice Guidelines: A Step-by-Step Framework](https://aistyleguide.com/blog/crafting-brand-voice-guidelines-a-step-by-step-framework).'
      END as final
    FROM step2
  )
  SELECT final FROM step3
)
WHERE slug = 'why-nikes-find-your-greatness-resonates';

COMMIT;

-- Verification queries: Check first ~200 chars and last ~200 chars for each post
SELECT 
  slug,
  LEFT(content, 200) as first_200_chars,
  RIGHT(content, 200) as last_200_chars,
  LENGTH(content) as content_length,
  CASE 
    WHEN content LIKE '%\n\nNext steps:%' THEN 'Has Next steps'
    ELSE 'Missing Next steps'
  END as next_steps_status
FROM blog_posts
WHERE slug IN (
  'marketing-tone-of-voice-examples-that-convert',
  'mailchimp-tone-of-voice-lessons-from-a-saas-favorite',
  'mastering-voice-and-tone-examples-for-copywriters',
  'why-nikes-find-your-greatness-resonates'
)
ORDER BY slug;
