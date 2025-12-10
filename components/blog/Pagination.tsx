import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  basePath?: string
}

export default function Pagination({ 
  currentPage, 
  totalPages, 
  hasNext, 
  hasPrev,
  basePath = '/blog'
}: PaginationProps) {
  const getPageUrl = (page: number) => {
    return page === 1 ? basePath : `${basePath}?page=${page}`
  }

  const getVisiblePages = () => {
    const pages = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {/* Previous Button */}
      {hasPrev ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={getPageUrl(currentPage - 1)} className="flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled className="flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
      )}

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {getVisiblePages().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-3 py-2 text-muted-foreground">
                ...
              </span>
            )
          }
          
          const pageNum = page as number
          const isActive = pageNum === currentPage
          
          return (
            <Button
              key={pageNum}
              variant={isActive ? "default" : "outline"}
              size="sm"
              asChild={!isActive}
              disabled={isActive}
              className="min-w-[40px]"
            >
              {isActive ? (
                <span>{pageNum}</span>
              ) : (
                <Link href={getPageUrl(pageNum)}>{pageNum}</Link>
              )}
            </Button>
          )
        })}
      </div>

      {/* Next Button */}
      {hasNext ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={getPageUrl(currentPage + 1)} className="flex items-center gap-1">
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled className="flex items-center gap-1">
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
























