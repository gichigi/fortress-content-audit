"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ExternalLink, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

// Available categories matching the API endpoint
const AVAILABLE_CATEGORIES = [
  'Tone Of Voice Fundamentals',
  'Brand Voice Foundations',
  'Guidelines & Templates',
  'Examples & Case Studies',
  'Channel & Execution'
]

interface GeneratedPost {
  slug: string
  title: string
}

export default function BlogGenerator() {
  const [topic, setTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [category, setCategory] = useState('')
  const [publish, setPublish] = useState(true)
  const [loading, setLoading] = useState(false)
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null)
  const [errors, setErrors] = useState<{ topic?: string }>({})
  
  const { toast } = useToast()

  const validateForm = () => {
    const newErrors: { topic?: string } = {}
    
    if (!topic.trim()) {
      newErrors.topic = 'Topic is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setGeneratedPost(null)

    try {
      // Parse keywords if provided
      const keywordsArray = keywords.trim() 
        ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
        : []

      const requestBody = {
        topic: topic.trim(),
        keywords: keywordsArray,
        ...(category && { category }),
        publish
      }

      const response = await fetch('/api/blog/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      // Check response status before parsing JSON
      if (!response.ok) {
        let errorMessage = 'Failed to generate blog post'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()

      setGeneratedPost({
        slug: data.post.slug,
        title: data.post.title
      })

      toast({
        title: "Blog post generated successfully!",
        description: `"${data.post.title}" has been ${publish ? 'published' : 'saved as draft'}`,
      })

    } catch (error) {
      console.error('Error generating blog post:', error)
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAnother = () => {
    setTopic('')
    setKeywords('')
    setCategory('')
    setPublish(true)
    setGeneratedPost(null)
    setErrors({})
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Blog Post Generator</h1>
          <LogoutButton />
        </div>
        <p className="text-muted-foreground">
          Generate AI-powered blog posts with your topic and optional keywords
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Blog Post</CardTitle>
          <CardDescription>
            Enter a topic to generate a new blog post. Keywords and category are optional - leave blank to auto-generate.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {generatedPost ? (
            // Success state
            <div className="text-center space-y-4">
              <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                  Post Generated Successfully!
                </h3>
                <p className="text-green-700 dark:text-green-300 mb-4">
                  "{generatedPost.title}"
                </p>
                <div className="flex gap-3 justify-center">
                  <Button asChild>
                    <Link href={`/blog/${generatedPost.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Post
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={handleGenerateAnother}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Generate Another
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Form state
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., How to create a consistent brand voice"
                  disabled={loading}
                  className={errors.topic ? 'border-red-500' : ''}
                />
                {errors.topic && (
                  <p className="text-sm text-red-500">{errors.topic}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords</Label>
                <Textarea
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="brand voice, consistency, marketing, tone"
                  disabled={loading}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  Optional: Leave blank to auto-generate, or enter comma-separated keywords
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Optional: Leave blank to auto-generate based on topic
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="publish"
                  checked={publish}
                  onCheckedChange={setPublish}
                  disabled={loading}
                />
                <Label htmlFor="publish">
                  Publish immediately (uncheck to save as draft)
                </Label>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Blog Post'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

