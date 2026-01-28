"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

interface AuditProgressProps {
  currentStep?: 'review' | 'fix' | 'reaudit'
}

const steps = [
  { id: 'complete', label: 'Audit Complete' },
  { id: 'review', label: 'Review Issues' },
  { id: 'fix', label: 'Fix Issues' },
  { id: 'reaudit', label: 'Rerun audit' },
] as const

export function AuditProgress({ currentStep = 'review' }: AuditProgressProps) {
  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  
  return (
    <div className="px-4 lg:px-6 mb-4">
      <Card className="border border-border bg-gradient-to-br from-background to-muted/30">
        <CardContent className="py-4 px-6">
          <div className="flex items-center gap-3 flex-wrap">
            {steps.map((step, index) => {
              const isCurrent = step.id === currentStep
              const isPast = index < currentStepIndex
              const isFuture = index > currentStepIndex
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-2">
                    {isPast ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : isCurrent ? (
                      <Circle className="h-4 w-4 text-primary fill-primary shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm font-medium",
                      isCurrent && "text-primary font-semibold",
                      isPast && "text-muted-foreground",
                      isFuture && "text-muted-foreground/60"
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <span className="text-muted-foreground/30 text-lg">→</span>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
