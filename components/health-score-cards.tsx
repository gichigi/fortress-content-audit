"use client"

import { TrendingDownIcon, TrendingUpIcon, Minus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface HealthScoreCardsProps {
  currentScore?: {
    score: number
    metrics?: {
      totalActive: number
      totalCritical: number
      pagesWithIssues: number
      criticalPages: number
    }
  }
  previousScore?: number
  loading?: boolean
}

export function HealthScoreCards({ currentScore, previousScore, loading }: HealthScoreCardsProps) {
  if (loading || !currentScore) {
    return (
      <div className="@xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 lg:px-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-border">
            <CardHeader>
              <CardDescription>Loading...</CardDescription>
              <CardTitle className="text-2xl font-semibold">-</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  const score = Math.round(currentScore.score)
  const metrics = currentScore.metrics || {}
  
  // Calculate trend
  const trend = previousScore !== undefined ? score - previousScore : 0
  const TrendIcon = trend > 0 ? TrendingUpIcon : trend < 0 ? TrendingDownIcon : Minus
  const trendColor = trend > 0 ? "text-green-600" : trend < 0 ? "text-destructive" : "text-muted-foreground"

  return (
    <div className="@xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <Card className="@container/card border border-border">
        <CardHeader className="relative">
          <CardDescription>Health Score</CardDescription>
          <CardTitle className={`@[250px]/card:text-3xl text-2xl font-semibold tabular-nums ${
            score >= 80 ? 'text-green-600' :
            score >= 50 ? 'text-yellow-600' :
            'text-destructive'
          }`}>
            {score}/100
          </CardTitle>
          {previousScore !== undefined && (
            <div className="absolute right-4 top-4">
              <Badge variant="outline" className={`flex gap-1 rounded-lg text-xs ${trendColor}`}>
                <TrendIcon className="size-3" />
                {trend > 0 ? '+' : ''}{trend.toFixed(0)}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {score >= 80 ? 'Excellent content quality' :
             score >= 50 ? 'Good content quality' :
             'Needs improvement'}
            {trend > 0 && <TrendingUpIcon className="size-4" />}
            {trend < 0 && <TrendingDownIcon className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            Content quality score based on active issues
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card border border-border">
        <CardHeader className="relative">
          <CardDescription>Total Active Issues</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.totalActive || 0}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Issues found across all audits
          </div>
          <div className="text-muted-foreground">
            Excludes ignored issues
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card border border-border">
        <CardHeader className="relative">
          <CardDescription>Critical Issues</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums text-destructive">
            {metrics.totalCritical || 0}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            High-severity issues requiring attention
          </div>
          <div className="text-muted-foreground">
            Issues that impact user experience
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card border border-border">
        <CardHeader className="relative">
          <CardDescription>Pages with Issues</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {metrics.pagesWithIssues || 0}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Pages requiring content fixes
          </div>
          <div className="text-muted-foreground">
            Unique pages with active issues
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

