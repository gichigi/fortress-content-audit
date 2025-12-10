export type TraitName =
  | "Assertive"
  | "Witty"
  | "Direct"
  | "Inspiring"
  | "Warm"
  | "Inclusive"
  | "Playful"
  | "Supportive"
  | "Refined"

interface VoiceTrait {
  hoverSummary: string
  definition: string
  do: string[]
  dont: string[]
  example: { before: string; after: string }
}

// New interfaces for custom traits
export interface CustomTrait {
  id: string
  name: string
  isCustom: true
}

export interface PredefinedTrait {
  name: TraitName
  isCustom: false
  hoverSummary: string
  definition: string
  do: string[]
  dont: string[]
  example: { before: string; after: string }
}

export type MixedTrait = CustomTrait | PredefinedTrait

// Utility functions for trait handling
export function createCustomTrait(name: string): CustomTrait {
  return {
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    isCustom: true
  }
}

export function isPredefinedTrait(trait: MixedTrait): trait is PredefinedTrait {
  return !trait.isCustom
}

export function isCustomTrait(trait: MixedTrait): trait is CustomTrait {
  return trait.isCustom
}

export function getPredefinedTrait(name: TraitName): PredefinedTrait {
  const traitData = TRAITS[name]
  return {
    name,
    isCustom: false,
    ...traitData
  }
}

// Validation functions
export function isValidCustomTraitName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 20) return false
  
  // Check if name matches any predefined trait
  const predefinedNames = Object.keys(TRAITS).map(n => n.toLowerCase())
  if (predefinedNames.includes(trimmed.toLowerCase())) return false
  
  // Basic sanitization - only allow letters, numbers, spaces, hyphens
  const validPattern = /^[a-zA-Z0-9\s\-]+$/
  return validPattern.test(trimmed)
}

// localStorage functions for custom traits
export function saveCustomTraits(customTraits: CustomTrait[]): void {
  try {
    localStorage.setItem('customTraits', JSON.stringify(customTraits))
  } catch (error) {
    console.error('Error saving custom traits to localStorage:', error)
  }
}

export function loadCustomTraits(): CustomTrait[] {
  try {
    const saved = localStorage.getItem('customTraits')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed.filter(trait => 
          trait && 
          typeof trait.id === 'string' && 
          typeof trait.name === 'string' && 
          trait.isCustom === true
        )
      }
    }
  } catch (error) {
    console.error('Error loading custom traits from localStorage:', error)
  }
  return []
}

// Mixed trait localStorage functions
export function saveMixedTraits(traits: MixedTrait[]): void {
  try {
    // Save only the essential data for reconstruction
    const traitData = traits.map(trait => {
      if (trait.isCustom) {
        return { type: 'custom', id: trait.id, name: trait.name }
      } else {
        return { type: 'predefined', name: trait.name }
      }
    })
    localStorage.setItem('selectedTraits', JSON.stringify(traitData))
  } catch (error) {
    console.error('Error saving mixed traits to localStorage:', error)
  }
}

export function loadMixedTraits(): MixedTrait[] {
  try {
    const saved = localStorage.getItem('selectedTraits')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        const customTraits = loadCustomTraits()
        
        return parsed.map(item => {
          if (item.type === 'custom') {
            // Find matching custom trait
            const customTrait = customTraits.find(ct => ct.id === item.id)
            return customTrait || createCustomTrait(item.name)
          } else if (item.type === 'predefined' && Object.keys(TRAITS).includes(item.name as TraitName)) {
            return getPredefinedTrait(item.name as TraitName)
          }
          return null
        }).filter(Boolean) as MixedTrait[]
      }
    }
  } catch (error) {
    console.error('Error loading mixed traits from localStorage:', error)
  }
  return []
}

export const TRAITS: Record<TraitName, VoiceTrait> = {
  Assertive: {
    hoverSummary: "Confident voice that states the stakes.",
    definition: "Confident and self-assured communication that states positions clearly without being aggressive",
    do: [
      "State facts clearly and back claims with evidence",
      "Use decisive language that shows confidence",
      "Stand firm in your position while remaining respectful",
    ],
    dont: [
      "Be aggressive or pushy",
      "Make claims without evidence",
      "Back down when you should stand firm",
    ],
    example: {
      before: "We think this might possibly help in some cases",
      after: "Here's exactly why this approach works better",
    },
  },
  Witty: {
    hoverSummary: "Smart humor with a quick grin.",
    definition: "Clever, sharp humor that shows intelligence without being silly or inappropriate",
    do: [
      "Use clever wordplay and unexpected connections that make people smile",
      "Reference cultural moments or shared experiences your audience knows",
      "Time humor appropriately to enhance rather than distract from your message",
    ],
    dont: [
      "Use humor that could offend or exclude part of your audience",
      "Be silly when serious communication is needed",
      "Force jokes that don't naturally fit the context",
    ],
    example: {
      before: "Our system is currently unavailable due to technical issues",
      after: "Our servers decided to take an unscheduled coffee break. Back in 5 minutes!",
    },
  },
  Direct: {
    hoverSummary: "No fluff, straight to the point.",
    definition: "Clear and straightforward communication that gets to the point without unnecessary fluff",
    do: [
      "State your main message upfront without beating around the bush",
      "Use simple, clear language that leaves no room for confusion",
      "Focus on what matters most to your audience",
    ],
    dont: [
      "Bury the main point in unnecessary details",
      "Use complex jargon when simple words work",
      "Add fluff that doesn't serve the message",
    ],
    example: {
      before: "We're excited to introduce an innovative solution that may potentially help optimize your workflow efficiency",
      after: "This feature saves you 2 hours per week. Here's how.",
    },
  },
  Inspiring: {
    hoverSummary: "Keeps energy high and momentum moving.",
    definition: "Motivating and uplifting communication that encourages people to take action and reach their potential",
    do: [
      "Focus on possibilities and what people can achieve",
      "Use encouraging language that builds confidence and momentum",
      "Share stories and examples that motivate positive change",
    ],
    dont: [
      "Focus on limitations or what can't be done",
      "Use discouraging or negative language",
      "Promise unrealistic outcomes",
    ],
    example: {
      before: "This process can be challenging and may not work for everyone",
      after: "You're already closer to success than you think—here's your next step",
    },
  },
  Warm: {
    hoverSummary: "Feels personal, welcoming, and genuine.",
    definition: "Genuine human connection that feels personal and caring without being overly emotional",
    do: [
      "Use personal pronouns and inclusive language that brings people closer",
      "Acknowledge individual experiences and show you care about outcomes",
      "Express genuine appreciation and recognition when appropriate",
    ],
    dont: [
      "Sound distant or transactional in important moments",
      "Use overly emotional language that feels manipulative",
      "Fake warmth or use generic pleasantries without meaning",
    ],
    example: {
      before: "User account has been successfully created. Proceed to next step.",
      after: "Welcome! We're excited to have you here and can't wait to see what you create.",
    },
  },
  Inclusive: {
    hoverSummary: "Invites everyone in without assumptions.",
    definition: "Welcoming communication that makes everyone feel seen, valued, and able to participate",
    do: [
      "Use language that welcomes all backgrounds and abilities",
      "Avoid assumptions about knowledge, experience, or circumstances",
      "Create content that works for diverse audiences",
    ],
    dont: [
      "Make assumptions about your audience's background",
      "Use exclusionary language or references",
      "Ignore accessibility and diverse needs",
    ],
    example: {
      before: "Every professional knows that networking is essential",
      after: "Whether you're starting out or switching careers...",
    },
  },
  Playful: {
    hoverSummary: "Light, fun, and a little cheeky.",
    definition: "Light-hearted and fun communication that brings joy while staying professional and on-brand",
    do: [
      "Use humor, wordplay, and creative metaphors appropriately",
      "Add personality through unexpected but relevant references",
      "Keep things interesting with varied sentence structure",
    ],
    dont: [
      "Use humor that could offend or exclude",
      "Be silly when serious communication is needed",
      "Let playfulness overshadow the main message",
    ],
    example: {
      before: "We are currently experiencing technical difficulties",
      after: "Our servers are having a coffee break—back in 5 minutes!",
    },
  },
  Supportive: {
    hoverSummary: "Reassuring voice that's got your back.",
    definition: "Understanding and encouraging communication that acknowledges challenges while offering helpful guidance",
    do: [
      "Acknowledge difficulties people face before offering solutions",
      "Use 'we're in this together' language that builds trust",
      "Provide reassurance while maintaining realistic expectations",
    ],
    dont: [
      "Dismiss or minimize real challenges",
      "Sound patronizing or condescending",
      "Promise solutions you can't deliver",
    ],
    example: {
      before: "This is simple and straightforward for most users",
      after: "We know this feels overwhelming—let's break it into manageable steps",
    },
  },
  Refined: {
    hoverSummary: "Polished tone with graceful restraint.",
    definition: "Elegant and polished communication that respects your audience's intellect and expertise",
    do: [
      "Use precise language and nuanced explanations",
      "Reference relevant cultural, industry, or intellectual contexts",
      "Maintain elegance without being pretentious",
    ],
    dont: [
      "Talk down to your audience",
      "Use unnecessarily complex language to sound smart",
      "Be pretentious or show-offy",
    ],
    example: {
      before: "Our super easy tool makes hard stuff simple for anyone!",
      after: "We've distilled complexity into clarity—just as you would",
    },
  },
} 