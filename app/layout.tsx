import type React from "react"
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@vercel/analytics/next"
import { PostHogProvider } from "@/components/PostHogProvider"

const geistSans = Geist({ subsets: ["latin"], display: "swap", variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono" })
const cormorantGaramond = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], display: "swap", variable: "--font-serif" })

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aistyleguide.com'),
  title: "Brand voice is the moat | Fortress",
  description: "Build unbreachable brand voice guidelines for consistent and compelling content, everywhere.",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  generator: 'v0.dev',
  authors: [{ name: 'Fortress' }],
  creator: 'Fortress',
  publisher: 'Fortress',
  openGraph: {
    title: "Brand voice is the moat | Fortress",
    description: "Build unbreachable brand voice guidelines for consistent and compelling content, everywhere.",
    url: 'https://aistyleguide.com',
    siteName: 'Fortress',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: 'https://aistyleguide.com/brand-voice-guidelines.png',
        width: 1200,
        height: 630,
        alt: 'Fortress - Build unbreachable brand voice guidelines',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Brand voice is the moat | Fortress",
    description: "Build unbreachable brand voice guidelines for consistent and compelling content, everywhere.",
    creator: '@tahigichigi',
    site: '@aistyleguide',
    images: ['https://aistyleguide.com/brand-voice-guidelines.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-943197631"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);} 
              gtag('js', new Date());
              gtag('config', 'AW-943197631');
            `,
          }}
        />
        
        {/* Explicit meta tags for compatibility */}
        <title>Brand voice is the moat | Fortress</title>
        <meta name="description" content="Build unbreachable brand voice guidelines for consistent and compelling content, everywhere." />
        
        {/* WebPage Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "@id": "https://aistyleguide.com#webpage",
              "name": "Fortress — Brand voice is the moat",
              "description": "Build unbreachable brand voice guidelines for consistent and compelling content, everywhere.",
              "url": "https://aistyleguide.com",
              "primaryImageOfPage": "https://aistyleguide.com/brand-voice-guidelines.png",
              "inLanguage": "en",
              "isPartOf": {
                "@id": "https://aistyleguide.com#website"
              },
              "mainEntity": {
                "@id": "https://aistyleguide.com#software"
              },
              "datePublished": "2024-01-01",
              "dateModified": "2024-11-04"
            })
          }}
        />
        
        {/* WebSite Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": "https://aistyleguide.com#website",
              "name": "Fortress",
              "url": "https://aistyleguide.com",
              "description": "Build unbreachable brand voice guidelines for consistent and compelling content, everywhere.",
            })
          }}
        />
        
        {/* Schema.org markup for SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "@id": "https://aistyleguide.com#software",
              "name": "Fortress",
              "description": "Build unbreachable brand voice guidelines for consistent and compelling content, everywhere.",
              "brand": {
                "@type": "Brand",
                "name": "Fortress"
              },
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web Browser",
              "url": "https://aistyleguide.com",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock"
              },
              "creator": {
                "@id": "https://aistyleguide.com#organization"
              }
            })
          }}
        />
        
        {/* FAQ Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What if I don't have a brand yet?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Our tool helps you define your brand voice from scratch. Just answer a few questions about your audience and goals."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How long does it take?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Most style guides are generated in under 2 minutes. You can review, download in multiple formats, and share with your team."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What formats can I download?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Your style guide is available in PDF, Word, HTML, and Markdown formats for easy sharing and integration with any workflow."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What's included in the style guide?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "You'll get a brand voice definition, up to 99+ writing rules, tone guidelines, and practical examples tailored to your brand."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Can I edit my style guide?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Absolutely. Once generated, you can download Word, HTML, or Markdown, then edit however you like before saving or sharing."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Is this better than hiring a copywriter?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "We deliver 90% of what most brands need in minutes instead of weeks, at a fraction of the cost of hiring a professional writer."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Can I share with my team?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes! Share your style guide with your entire team. You receive a permanent access link plus downloadable files."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How do I contact support?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Email us at support@aistyleguide.com for any questions. We typically respond within 24 hours on business days."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How do I get a refund?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "We offer a 30-day money-back guarantee. Simply email support@aistyleguide.com within 30 days of your purchase for a full refund. No questions asked - we process refunds quickly, usually within 1-2 business days."
                  }
                }
              ]
            })
          }}
        />
        
        {/* HowTo Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "HowTo",
              "name": "How to Create a Brand Style Guide",
              "description": "Generate a comprehensive style guide with just a few clicks",
              "step": [
                {
                  "@type": "HowToStep",
                  "name": "Answer a few questions",
                  "text": "Tell us about your brand or let our AI extract details from your website"
                },
                {
                  "@type": "HowToStep",
                  "name": "Get personalized rules",
                  "text": "Receive a tailored tone of voice + 99+ writing rules for your brand"
                },
                {
                  "@type": "HowToStep",
                  "name": "Export and share",
                  "text": "Download in multiple formats: PDF, Word, HTML, or Markdown for any workflow"
                }
              ]
            })
          }}
        />
        
        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": "https://aistyleguide.com#organization",
              "name": "Fortress",
              "url": "https://aistyleguide.com",
              "logo": {
                "@type": "ImageObject",
                "url": "https://aistyleguide.com/logo-wordmark.svg",
                "width": 184,
                "height": 32
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "email": "support@aistyleguide.com",
                "contactType": "customer support"
              },
              "sameAs": [
                "https://twitter.com/aistyleguide"
              ]
            })
          }}
        />
      </head>
      <body className={`font-sans overflow-x-hidden ${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} antialiased`}>        
        <PostHogProvider>
          <ThemeProvider attribute="class" defaultTheme="light">
            {children}
            <Toaster />
          </ThemeProvider>
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  )
}