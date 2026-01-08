import type React from "react"
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@vercel/analytics/next"
import { PostHogProvider } from "@/components/PostHogProvider"
import Header from "@/components/Header"

const geistSans = Geist({ subsets: ["latin"], display: "swap", variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono" })
const cormorantGaramond = Cormorant_Garamond({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], display: "swap", variable: "--font-serif" })

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aistyleguide.com'),
  title: "Content Audit | Fortress",
  description: "AI-powered content auditing to identify inconsistencies, terminology conflicts, and voice issues across your website.",
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
    title: "Content Audit | Fortress",
    description: "AI-powered content auditing to identify inconsistencies, terminology conflicts, and voice issues across your website.",
    url: 'https://aistyleguide.com',
    siteName: 'Fortress',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: 'https://aistyleguide.com/logo-wordmark.svg',
        width: 184,
        height: 32,
        alt: 'Fortress - Content Audit Platform',
        type: 'image/svg+xml',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Content Audit | Fortress",
    description: "AI-powered content auditing to identify inconsistencies, terminology conflicts, and voice issues across your website.",
    creator: '@tahigichigi',
    site: '@aistyleguide',
    images: ['https://aistyleguide.com/logo-wordmark.svg'],
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
        <title>Content Audit | Fortress</title>
        <meta name="description" content="AI-powered content auditing to identify inconsistencies, terminology conflicts, and voice issues across your website." />
        
        {/* WebPage Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "@id": "https://aistyleguide.com#webpage",
              "name": "Fortress — Content Audit",
              "description": "AI-powered content auditing to identify inconsistencies, terminology conflicts, and voice issues across your website.",
              "url": "https://aistyleguide.com",
              "primaryImageOfPage": "https://aistyleguide.com/logo-wordmark.svg",
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
              "description": "AI-powered content auditing to identify inconsistencies, terminology conflicts, and voice issues across your website.",
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
              "description": "AI-powered content auditing to identify inconsistencies, terminology conflicts, and voice issues across your website.",
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
                  "name": "How does content auditing work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Enter your website URL and Fortress automatically crawls up to 10 pages, analyzing content for terminology conflicts, contradictory claims, voice inconsistencies, and naming conflicts using AI."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How long does an audit take?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Most audits complete in 5-10 minutes. You'll receive a detailed report with prioritized issues, specific examples, and URLs where problems were found."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What types of issues does Fortress find?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Fortress identifies 4 core issue types: terminology conflicts (same concept called different names), contradictory claims (facts/numbers that don't match), voice inconsistencies (formal vs casual tone switching), and naming conflicts (product/brand names spelled differently)."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Can I save and track audits over time?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes! Sign up to save audits to your dashboard, track your health score over time, and export reports in PDF or JSON format."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Is there a free option?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes, you can run free 10-page audits without signing up. Create an account to save results, track progress, and access unlimited audits with paid plans."
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
              "name": "How to Audit Your Website Content",
              "description": "Run a comprehensive content audit in minutes",
              "step": [
                {
                  "@type": "HowToStep",
                  "name": "Enter your website URL",
                  "text": "Paste your website URL on the homepage. Fortress will automatically crawl up to 10 pages."
                },
                {
                  "@type": "HowToStep",
                  "name": "Review audit results",
                  "text": "Get a detailed report with prioritized issues, specific examples, and URLs where problems were found."
                },
                {
                  "@type": "HowToStep",
                  "name": "Save and track progress",
                  "text": "Sign up to save audits to your dashboard, track your health score over time, and export reports in PDF or JSON."
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
            <Header />
            {children}
            <Toaster />
          </ThemeProvider>
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  )
}