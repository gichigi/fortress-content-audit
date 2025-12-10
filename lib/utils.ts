import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Brand name utility - single source of truth
export const getBrandName = (brandDetails: any): string => {
  // Use the name field directly since it's now required
  if (brandDetails?.name && brandDetails.name.trim()) {
    return brandDetails.name.trim()
  }
  
  // Fall back to generic placeholder (should rarely happen now)
  return "Your Brand"
}
