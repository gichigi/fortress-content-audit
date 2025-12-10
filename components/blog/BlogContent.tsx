'use client'

import { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface BlogContentProps {
  children: ReactNode
  className?: string
}

export default function BlogContent({ children, className = '' }: BlogContentProps) {
  const content = typeof children === 'string' ? children : String(children || '')
  
  // Wrap quoted text in emphasis tags for italic styling
  const processedContent = content.replace(
    /"([^"]+)"/g,
    (match, quoteText) => {
      // Don't wrap if already in markdown emphasis/bold
      if (match.includes('*') || match.includes('_')) return match
      return `_"${quoteText}"_`
    }
  )

  return (
    <div
      className={`prose prose-xl dark:prose-invert max-w-[47.6rem]
      prose-headings:font-semibold prose-headings:tracking-tight
      prose-h1:text-4xl md:prose-h1:text-5xl prose-h1:leading-tight prose-h1:mt-12 prose-h1:mb-6
      prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:leading-snug prose-h2:mt-10 prose-h2:mb-4
      prose-h3:text-xl md:prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3
      prose-p:leading-[1.6] prose-p:tracking-[-0.003em] prose-p:text-blog-text prose-p:mb-6
      prose-a:text-primary prose-a:underline prose-a:underline-offset-4 hover:prose-a:underline-offset-2 prose-a:transition-all prose-a:decoration-primary/60 hover:prose-a:decoration-primary
      prose-ul:my-6 prose-ol:my-6 prose-li:my-2 prose-li:leading-8 md:prose-li:leading-9
      prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-6 prose-blockquote:my-8 prose-blockquote:text-muted-foreground prose-blockquote:italic prose-blockquote:font-medium
      prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
      prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-4 prose-pre:my-8
      prose-img:rounded-lg prose-img:my-8 prose-img:shadow-md
      prose-hr:my-12 prose-hr:border-t-2
      prose-strong:font-semibold prose-em:italic
      ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}


