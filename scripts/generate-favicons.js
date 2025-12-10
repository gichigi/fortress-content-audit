#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import toIco from 'to-ico'

/**
 * Generate favicon files from the logo-icon.svg
 */
async function generateFavicons() {
  try {
    const publicDir = path.join(process.cwd(), 'public')
    const logoIconPath = path.join(publicDir, 'logo-icon.svg')
    
    // Check if logo-icon.svg exists
    if (!fs.existsSync(logoIconPath)) {
      throw new Error('logo-icon.svg not found. Run generate-logo-svgs.js first.')
    }
    
    console.log('🎯 Generating favicon files from logo-icon.svg...')
    
    // Read the SVG file
    const svgBuffer = fs.readFileSync(logoIconPath)
    
    // Generate PNG files at different sizes
    const sizes = [
      { size: 16, name: 'favicon-16x16.png' },
      { size: 32, name: 'favicon-32x32.png' },
      { size: 48, name: 'favicon-48x48.png' }, // For ICO generation
      { size: 180, name: 'apple-touch-icon.png' },
      { size: 192, name: 'android-chrome-192x192.png' },
      { size: 512, name: 'android-chrome-512x512.png' }
    ]
    
    const pngBuffers = []
    
    for (const { size, name } of sizes) {
      console.log(`📐 Generating ${name} (${size}x${size})...`)
      
      const pngBuffer = await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer()
      
      // Save PNG file
      const pngPath = path.join(publicDir, name)
      fs.writeFileSync(pngPath, pngBuffer)
      
      // Store buffers for ICO generation (16, 32, 48 only)
      if (size <= 48) {
        pngBuffers.push(pngBuffer)
      }
      
      console.log(`✅ Generated ${name}`)
    }
    
    // Generate multi-size ICO file
    console.log('🔄 Generating favicon.ico (multi-size)...')
    const icoBuffer = await toIco(pngBuffers)
    const icoPath = path.join(publicDir, 'favicon.ico')
    fs.writeFileSync(icoPath, icoBuffer)
    console.log('✅ Generated favicon.ico')
    
    console.log('\n🎉 All favicon files generated successfully!')
    console.log(`📁 Files saved to: ${publicDir}`)
    console.log('📋 Generated files:')
    console.log('   • favicon.ico (16x16, 32x32, 48x48)')
    console.log('   • favicon-16x16.png')
    console.log('   • favicon-32x32.png')
    console.log('   • apple-touch-icon.png (180x180)')
    console.log('   • android-chrome-192x192.png')
    console.log('   • android-chrome-512x512.png')
    
  } catch (error) {
    console.error('❌ Error generating favicons:', error)
    process.exit(1)
  }
}

// Run the script
generateFavicons()
