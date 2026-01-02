"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

interface HealthScoreDataPoint {
  date: string
  score: number
  metrics: {
    totalActive: number
    totalCritical: number
    criticalPages: number
    pagesWithIssues: number
  }
}

interface HealthScoreChartProps {
  data: HealthScoreDataPoint[]
  domain?: string
}

const chartConfig = {
  score: {
    label: "Health Score",
    color: "rgb(22 163 74)", // green-600, matches health score cards
  },
} satisfies ChartConfig

// Chart color - green-600 to match health score cards
const chartColor = "rgb(22 163 74)"

export function HealthScoreChart({ data, domain }: HealthScoreChartProps) {
  const isMobile = useMobile()
  const [timeRange, setTimeRange] = React.useState("30")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("30")
    }
  }, [isMobile])

  // Filter data based on time range
  const days = parseInt(timeRange, 10)
  const filteredData = React.useMemo(() => {
    if (!data || data.length === 0) return []
    
    const cutoffDate = new Date()
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - days)
    cutoffDate.setUTCHours(0, 0, 0, 0)
    
    return data.filter((item) => {
      const itemDate = new Date(item.date)
      return itemDate >= cutoffDate
    })
  }, [data, days])

  // Format data for chart (ensure score is number)
  const chartData = filteredData.map((item) => ({
    date: item.date,
    score: typeof item.score === 'number' ? item.score : 0,
    totalActive: item.metrics?.totalActive || 0,
    totalCritical: item.metrics?.totalCritical || 0,
    criticalPages: item.metrics?.criticalPages || 0,
    pagesWithIssues: item.metrics?.pagesWithIssues || 0,
  }))

  // Check if we have data to display (use chartData instead of data)
  if (chartData.length === 0) {
    return (
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="font-serif text-2xl font-semibold">Health Score</CardTitle>
          <CardDescription>
            {domain ? `Content quality score for ${domain}` : "Content quality score over time"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No health score data available. Run an audit to see your content quality score.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card border border-border">
      <CardHeader className="relative">
        <CardTitle className="font-serif text-2xl font-semibold">Health Score</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Content quality score over the last {days} days
          </span>
          <span className="@[540px]/card:hidden">Last {days} days</span>
        </CardDescription>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90" className="h-8 px-2.5">
              90 days
            </ToggleGroupItem>
            <ToggleGroupItem value="60" className="h-8 px-2.5">
              60 days
            </ToggleGroupItem>
            <ToggleGroupItem value="30" className="h-8 px-2.5">
              30 days
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="@[767px]/card:hidden flex w-32"
              aria-label="Select time range"
            >
              <SelectValue placeholder="30 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90" className="rounded-lg">
                90 days
              </SelectItem>
              <SelectItem value="60" className="rounded-lg">
                60 days
              </SelectItem>
              <SelectItem value="30" className="rounded-lg">
                30 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart 
            data={chartData}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="fillScore" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={chartColor}
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor={chartColor}
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              domain={chartData.length === 1 ? ['dataMin', 'dataMax'] : undefined}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }}
                  indicator="dot"
                  formatter={(value, name) => {
                    if (name === 'score') {
                      return [`${value}/100`, 'Health Score']
                    }
                    return [value, name]
                  }}
                />
              }
            />
            <Area
              dataKey="score"
              type="natural"
              fill="url(#fillScore)"
              stroke={chartColor}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

