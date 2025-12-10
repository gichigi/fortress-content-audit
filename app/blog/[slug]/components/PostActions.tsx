"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2, CheckCircle2 } from 'lucide-react'

interface PostActionsProps {
  slug: string
  isPublished: boolean
}

export default function PostActions({ slug, isPublished }: PostActionsProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const response = await fetch(`/api/blog/${slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'publish' }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to publish post')
      }

      toast({
        title: 'Post published!',
        description: 'The post has been published successfully.',
      })

      // Refresh the page to show updated state
      router.refresh()
    } catch (error) {
      console.error('Error publishing post:', error)
      toast({
        title: 'Publish failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/blog/${slug}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete post')
      }

      toast({
        title: 'Post deleted',
        description: 'The post has been deleted successfully.',
      })

      // Redirect to blog listing
      router.push('/blog')
    } catch (error) {
      console.error('Error deleting post:', error)
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Only show actions for unpublished posts
  if (isPublished) {
    return null
  }

  return (
    <>
      <div className="flex gap-3 mt-4">
        <Button
          onClick={handlePublish}
          disabled={isPublishing || isDeleting}
          className="flex-1"
        >
          {isPublishing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Publish Post
            </>
          )}
        </Button>
        <Button
          onClick={() => setShowDeleteDialog(true)}
          disabled={isPublishing || isDeleting}
          variant="destructive"
          className="flex-1"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the post
              and all of its content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

