import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  category: string
  featured_image?: string
  author_name: string
  published_at: string
  reading_time: number
  keywords: string[]
}

interface BlogCardProps {
  post: BlogPost
}


export default function BlogCard({ post }: BlogCardProps) {

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <Link href={`/blog/${post.slug}`}>
        <div className="relative overflow-hidden rounded-t-lg h-48">
          {post.featured_image ? (
            <>
              <Image
                src={post.featured_image}
                alt={post.title}
                fill
                quality={90}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              {/* Title and category overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-white drop-shadow-lg">{post.title}</h3>
                <Badge variant="secondary" className="bg-white/90 text-foreground">
                  {post.category}
                </Badge>
              </div>
            </>
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center border-b">
              <div className="text-center p-6">
                <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-foreground">{post.title}</h3>
                <Badge variant="secondary">
                  {post.category}
                </Badge>
              </div>
            </div>
          )}
        </div>
        
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
            {post.excerpt}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.reading_time} min read
            </span>
            <span className="text-primary font-medium text-sm group-hover:underline">
              Read more →
            </span>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}






