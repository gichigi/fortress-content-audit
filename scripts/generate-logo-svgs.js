#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

// Logo colors from CSS theme
const COLORS = {
  primary: '#0f172a',      // Top-left (HSL: 222.2 47.4% 11.2%)
  blue500: '#3B82F6',      // Top-right
  gray200: '#E5E7EB',      // Bottom-left (light mode)
  gray700: '#374151',      // Bottom-left (dark mode)
  indigo600: '#4F46E5'     // Bottom-right
}

// SVG dimensions and styling
const ICON_SIZE = 32
const BORDER_RADIUS = 6 // rounded-md = 0.375rem = 6px at 32px size

/**
 * Generate the icon-only SVG (4 colored squares)
 */
function generateIconSVG() {
  const halfSize = ICON_SIZE / 2
  
  return `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="rounded">
      <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="${BORDER_RADIUS}" ry="${BORDER_RADIUS}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#rounded)">
    <!-- Top-left: Primary -->
    <rect x="0" y="0" width="${halfSize}" height="${halfSize}" fill="${COLORS.primary}"/>
    <!-- Top-right: Blue-500 -->
    <rect x="${halfSize}" y="0" width="${halfSize}" height="${halfSize}" fill="${COLORS.blue500}"/>
    <!-- Bottom-left: Gray-200 (light mode) -->
    <rect x="0" y="${halfSize}" width="${halfSize}" height="${halfSize}" fill="${COLORS.gray200}"/>
    <!-- Bottom-right: Indigo-600 -->
    <rect x="${halfSize}" y="${halfSize}" width="${halfSize}" height="${halfSize}" fill="${COLORS.indigo600}"/>
  </g>
</svg>`
}

/**
 * Generate the wordmark SVG (icon + text)
 */
function generateWordmarkSVG() {
  const iconSize = 32
  const textX = iconSize + 12 // Gap between icon and text
  const fontSize = 20
  const totalWidth = textX + 140 // Approximate text width
  const totalHeight = Math.max(iconSize, fontSize + 4)
  
  return `<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="rounded">
      <rect width="${iconSize}" height="${iconSize}" rx="${BORDER_RADIUS}" ry="${BORDER_RADIUS}"/>
    </clipPath>
  </defs>
  
  <!-- Icon -->
  <g clip-path="url(#rounded)">
    <!-- Top-left: Primary -->
    <rect x="0" y="0" width="16" height="16" fill="${COLORS.primary}"/>
    <!-- Top-right: Blue-500 -->
    <rect x="16" y="0" width="16" height="16" fill="${COLORS.blue500}"/>
    <!-- Bottom-left: Gray-200 (light mode) -->
    <rect x="0" y="16" width="16" height="16" fill="${COLORS.gray200}"/>
    <!-- Bottom-right: Indigo-600 -->
    <rect x="16" y="16" width="16" height="16" fill="${COLORS.indigo600}"/>
  </g>
  
  <!-- Text -->
  <text x="${textX}" y="${fontSize + 2}" 
        font-family="Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif" 
        font-size="${fontSize}" 
        font-weight="600" 
        fill="#111827">AIStyleGuide</text>
</svg>`
}

/**
 * Main function to generate and save SVG files
 */
async function generateLogos() {
  try {
    const publicDir = path.join(process.cwd(), 'public')
    
    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
    }
    
    // Generate icon-only SVG
    const iconSVG = generateIconSVG()
    const iconPath = path.join(publicDir, 'logo-icon.svg')
    fs.writeFileSync(iconPath, iconSVG, 'utf8')
    console.log('✅ Generated logo-icon.svg')
    
    // Generate wordmark SVG
    const wordmarkSVG = generateWordmarkSVG()
    const wordmarkPath = path.join(publicDir, 'logo-wordmark.svg')
    fs.writeFileSync(wordmarkPath, wordmarkSVG, 'utf8')
    console.log('✅ Generated logo-wordmark.svg')
    
    console.log('\n🎨 Logo SVG files generated successfully!')
    console.log(`📁 Files saved to: ${publicDir}`)
    console.log('📋 Colors used:')
    console.log(`   • Primary (top-left): ${COLORS.primary}`)
    console.log(`   • Blue-500 (top-right): ${COLORS.blue500}`)
    console.log(`   • Gray-200 (bottom-left): ${COLORS.gray200}`)
    console.log(`   • Indigo-600 (bottom-right): ${COLORS.indigo600}`)
    
  } catch (error) {
    console.error('❌ Error generating logo SVGs:', error)
    process.exit(1)
  }
}

// Run the script
generateLogos()
