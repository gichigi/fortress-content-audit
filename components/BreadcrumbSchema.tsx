import React from 'react'

interface BreadcrumbItem {
  name: string
  url: string
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[]
}

/**
 * Reusable component for generating Schema.org BreadcrumbList JSON-LD
 * Used on subpages to provide structured breadcrumb navigation data
 */
export default function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(breadcrumbSchema)
      }}
    />
  )
}
