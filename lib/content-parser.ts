export interface StyleGuideSection {
  id: string
  title: string
  content: string
  level: number
  isMainSection: boolean
}

/**
 * Parse HTML content into sections for accordion display
 * Splits content based on H1 and H2 headings
 */
export function parseStyleGuideContent(html: string): StyleGuideSection[] {
  if (!html) return []

  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  const sections: StyleGuideSection[] = []
  const elements = Array.from(tempDiv.children)
  
  let currentSection: StyleGuideSection | null = null
  let sectionContent: HTMLElement[] = []

  elements.forEach((element, index) => {
    const tagName = element.tagName.toLowerCase()
    
    // Check if this is a heading that should create a new section
    if (tagName === 'h1' || tagName === 'h2') {
      // Save previous section if it exists
      if (currentSection && sectionContent.length > 0) {
        currentSection.content = sectionContent.map(el => el.outerHTML).join('')
        sections.push(currentSection)
      }

      // Create new section
      const title = element.textContent?.trim() || ''
      const level = parseInt(tagName.charAt(1))
      const id = generateSectionId(title)
      
      currentSection = {
        id,
        title,
        content: '',
        level,
        isMainSection: level <= 2
      }
      
      sectionContent = []
    } else {
      // Add content to current section
      if (currentSection) {
        sectionContent.push(element as HTMLElement)
      }
    }
  })

  // Don't forget the last section
  if (currentSection && sectionContent.length > 0) {
    currentSection.content = sectionContent.map(el => el.outerHTML).join('')
    sections.push(currentSection)
  }

  return sections
}

/**
 * Generate a URL-safe ID from section title
 */
function generateSectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * Get default open sections based on content type
 */
export function getDefaultOpenSections(sections: StyleGuideSection[]): string[] {
  const defaults: string[] = []
  
  // Always open the first section (usually the title/intro)
  if (sections.length > 0) {
    defaults.push(sections[0].id)
  }
  
  // Open "Brand Voice" section if it exists
  const brandVoiceSection = sections.find(section => 
    section.title.toLowerCase().includes('brand voice') ||
    section.title.toLowerCase().includes('voice')
  )
  if (brandVoiceSection) {
    defaults.push(brandVoiceSection.id)
  }
  
  return defaults
} 