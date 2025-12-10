-- Create blog_posts table for the AI Style Guide blog system
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'Brand Strategy',
  featured_image TEXT,
  author_name TEXT DEFAULT 'AI Style Guide',
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  word_count INTEGER DEFAULT 0,
  reading_time INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_blog_posts_updated_at 
    BEFORE UPDATE ON blog_posts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert a sample blog post for testing
INSERT INTO blog_posts (
  title,
  slug,
  content,
  excerpt,
  keywords,
  category,
  author_name,
  published_at,
  word_count,
  reading_time,
  is_published
) VALUES (
  'How to Create a Consistent Brand Voice That Converts',
  'consistent-brand-voice-converts',
  '# How to Create a Consistent Brand Voice That Converts

Your brand voice is more than just words on a page—it''s the personality that connects with your audience and drives action. In this comprehensive guide, we''ll explore the essential steps to develop a brand voice that not only resonates with your target audience but also converts prospects into loyal customers.

## What is Brand Voice?

Brand voice is the distinct personality and tone that your brand uses to communicate with your audience across all channels. It encompasses:

- **Tone**: The emotional inflection in your communication
- **Personality**: The human characteristics your brand embodies  
- **Language**: The specific words and phrases you use
- **Style**: How you structure and present your content

## Why Brand Voice Matters for Conversions

A consistent brand voice builds trust, creates emotional connections, and guides customers through their journey. Studies show that brands with consistent presentation across all platforms see revenue increases of up to 23%.

## Steps to Develop Your Brand Voice

### 1. Define Your Brand Personality

Start by identifying 3-5 core personality traits that represent your brand. Are you:
- Professional or casual?
- Authoritative or approachable?
- Innovative or traditional?

### 2. Know Your Audience

Understanding your audience is crucial for developing a voice that resonates. Consider:
- Demographics and psychographics
- Communication preferences
- Pain points and motivations
- Language they use

### 3. Create Voice Guidelines

Document your brand voice with specific guidelines including:
- Tone variations for different contexts
- Do''s and don''ts for language
- Example phrases and messaging
- Voice application across channels

### 4. Implement Consistently

Apply your brand voice across all touchpoints:
- Website copy
- Social media posts
- Email campaigns
- Customer service interactions
- Marketing materials

## Measuring Success

Track the impact of your consistent brand voice through:
- Engagement metrics
- Conversion rates
- Brand recognition surveys
- Customer feedback

## Conclusion

Developing a consistent brand voice is an investment in your brand''s long-term success. By following these steps and maintaining consistency across all channels, you''ll build stronger connections with your audience and drive better business results.',
  'Learn how to develop a consistent brand voice that builds trust, creates emotional connections, and drives conversions. Complete guide with actionable steps.',
  ARRAY['brand voice', 'brand consistency', 'content strategy', 'marketing', 'conversions', 'brand personality'],
  'Brand Strategy',
  'AI Style Guide',
  NOW(),
  850,
  4,
  true
);






