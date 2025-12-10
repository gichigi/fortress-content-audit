# Schema.org BlogPosting Reference

This document contains the official Schema.org BlogPosting schema documentation for reference when implementing and maintaining the blog system's structured data.

## BlogPosting Schema Overview

**Type Hierarchy**: Thing > CreativeWork > Article > SocialMediaPosting > BlogPosting

A blog post.

## Core Properties from Article

### Essential Properties
- **articleBody** (Text) - The actual body of the article
- **articleSection** (Text) - Articles may belong to one or more 'sections' in a magazine or newspaper, such as Sports, Lifestyle, etc.
- **wordCount** (Integer) - The number of words in the text of the CreativeWork such as an Article, Book, etc.

### Content Structure
- **pageEnd** (Integer or Text) - The page on which the work ends; for example "138" or "xvi"
- **pageStart** (Integer or Text) - The page on which the work starts; for example "135" or "xiii"
- **pagination** (Text) - Any description of pages that is not separated into pageStart and pageEnd
- **speakable** (SpeakableSpecification or URL) - Indicates sections of a Web page that are particularly 'speakable' for text-to-speech conversion

## Properties from CreativeWork

### Basic Information
- **about** (Thing) - The subject matter of the content
- **abstract** (Text) - An abstract is a short description that summarizes a CreativeWork
- **alternativeHeadline** (Text) - A secondary title of the CreativeWork
- **headline** (Text) - Headline of the article
- **description** (Text) - A description of the item

### Author & Publisher
- **author** (Organization or Person) - The author of this content or rating
- **publisher** (Organization or Person) - The publisher of the article in question
- **creator** (Organization or Person) - The creator/author of this CreativeWork
- **contributor** (Organization or Person) - A secondary contributor to the CreativeWork or Event
- **editor** (Person) - Specifies the Person who edited the CreativeWork

### Dates & Timeline
- **dateCreated** (Date or DateTime) - The date on which the CreativeWork was created
- **dateModified** (Date or DateTime) - The date on which the CreativeWork was most recently modified
- **datePublished** (Date or DateTime) - Date of first publication or broadcast

### Content & Media
- **text** (Text) - The textual content of this CreativeWork
- **image** (ImageObject or URL) - An image of the item
- **thumbnail** (ImageObject) - Thumbnail image for an image or video
- **thumbnailUrl** (URL) - A thumbnail image relevant to the Thing
- **audio** (AudioObject or Clip or MusicRecording) - An embedded audio object
- **video** (Clip or VideoObject) - An embedded video object

### SEO & Discovery
- **mainEntityOfPage** (CreativeWork or URL) - Indicates a page for which this thing is the main entity being described
- **url** (URL) - URL of the item
- **keywords** (DefinedTerm or Text or URL) - Keywords or tags used to describe some item
- **isPartOf** (CreativeWork or URL) - Indicates an item or CreativeWork that this item is part of
- **hasPart** (CreativeWork) - Indicates an item or CreativeWork that is part of this item

### Content Classification
- **genre** (Text or URL) - Genre of the creative work
- **inLanguage** (Language or Text) - The language of the content or performance
- **contentLocation** (Place) - The location depicted or described in the content
- **locationCreated** (Place) - The location where the CreativeWork was created

### Engagement & Interaction
- **comment** (Comment) - Comments, typically from users
- **commentCount** (Integer) - The number of comments this CreativeWork has received
- **review** (Review) - A review of the item
- **aggregateRating** (AggregateRating) - The overall rating, based on a collection of reviews

### Additional Properties
- **about** (Thing) - The subject matter of the content
- **mentions** (Thing) - Indicates that the CreativeWork contains a reference to, but is not necessarily about a concept
- **citation** (CreativeWork or Text) - A citation or reference to another creative work
- **isBasedOn** (CreativeWork or Product or URL) - A resource from which this work is derived

## Properties from Thing

### Basic Properties
- **name** (Text) - The name of the item
- **alternateName** (Text) - An alias for the item
- **additionalType** (Text or URL) - An additional type for the item
- **identifier** (PropertyValue or Text or URL) - The identifier property represents any kind of identifier
- **sameAs** (URL) - URL of a reference Web page that unambiguously indicates the item's identity

## Implementation Notes

### Required Properties for SEO
- **@context**: "https://schema.org"
- **@type**: "BlogPosting"
- **headline**: The title of the blog post
- **description**: Brief description/summary of the post
- **articleBody**: The actual body content of the article
- **datePublished**: Publication date
- **author**: Author information
- **publisher**: Publisher information

### Recommended Properties
- **dateModified**: Last modification date
- **mainEntityOfPage**: Canonical URL of the page
- **url**: Direct URL to the article
- **keywords**: Relevant keywords for the article
- **articleSection**: Category or section the article belongs to
- **wordCount**: Number of words in the article
- **image**: Featured image for the article

### Best Practices
1. **Complete Data**: Include as many relevant properties as possible
2. **Accurate Information**: Ensure all data is current and correct
3. **Proper Formatting**: Follow Schema.org data type requirements
4. **Consistent Structure**: Maintain the same structure across all blog posts
5. **Regular Updates**: Keep schema data current with content changes

---

*This reference contains the official Schema.org BlogPosting specification and should be updated when Schema.org specifications change.*
