'use client'

import { useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface ShareButtonProps {
  url: string
  title: string
}

export default function ShareButton({ url, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleShare = async () => {
    // Try Web Share API first (works on mobile and modern browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url,
        })
        return
      } catch (err) {
        // User cancelled or error - fall through to copy fallback
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err)
        }
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast({
        title: "Link copied!",
        description: "Blog post URL copied to clipboard.",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
      toast({
        title: "Copy failed",
        description: "Could not copy link. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </>
      )}
    </Button>
  )
}


