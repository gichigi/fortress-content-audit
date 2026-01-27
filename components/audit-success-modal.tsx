"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, FileText, Sparkles } from "lucide-react"

interface IssueBreakdown {
  critical: number
  medium: number
  low: number
}

interface Milestone {
  message: string
  type?: string
}

interface AuditSuccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  domain: string
  totalIssues: number
  issueBreakdown: IssueBreakdown
  milestones?: Milestone[]
  onViewResults: () => void
  onExport?: () => void
  pagesFound?: number | null
  pagesAudited?: number
}

export function AuditSuccessModal({
  open,
  onOpenChange,
  domain,
  totalIssues,
  issueBreakdown,
  milestones,
  onViewResults,
  onExport,
  pagesFound,
  pagesAudited,
}: AuditSuccessModalProps) {
  const handleViewResults = () => {
    onOpenChange(false)
    onViewResults()
  }

  const handleExport = () => {
    if (onExport) {
      onExport()
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <DialogTitle className="font-serif text-2xl font-semibold">
              Audit Complete!
            </DialogTitle>
          </div>
          <DialogDescription>
            {domain} has been audited successfully
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Issue Summary */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Issues Found</span>
              <span className="text-2xl font-bold font-serif">{totalIssues}</span>
            </div>

            {totalIssues > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Critical</span>
                  <span className="font-medium text-destructive">{issueBreakdown.critical}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Medium</span>
                  <span className="font-medium text-yellow-600">{issueBreakdown.medium}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Low</span>
                  <span className="font-medium text-blue-600">{issueBreakdown.low}</span>
                </div>
              </div>
            )}
          </div>

          {/* Pages audited info */}
          {(pagesFound !== null && pagesFound !== undefined) || (pagesAudited && pagesAudited > 0) ? (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              {pagesFound !== null && pagesFound !== undefined && pagesFound > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pages found</span>
                  <span className="font-medium">{pagesFound}</span>
                </div>
              )}
              {pagesAudited && pagesAudited > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pages audited</span>
                  <span className="font-medium">{pagesAudited}</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Milestones (if any) */}
          {milestones && milestones.length > 0 && (
            <Alert variant="outline" className="border-green-200 bg-green-50/50">
              <Sparkles className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900">Milestone Reached!</AlertTitle>
              <AlertDescription className="text-green-800">
                {milestones[0].message}
              </AlertDescription>
            </Alert>
          )}

          {/* Next Steps */}
          <Alert variant="outline">
            <AlertTitle>Next Steps</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside space-y-2 mt-2 text-sm">
                <li>Click "View Results" to see all issues</li>
                <li>Mark issues as resolved or ignored</li>
                <li>Export results as PDF or JSON for your records</li>
              </ol>
            </AlertDescription>
          </Alert>

          {totalIssues === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              🎉 No issues found! Your content is in great shape.
            </p>
          )}
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          {onExport && (
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <FileText className="h-4 w-4" />
              Export Audit
            </Button>
          )}
          <Button onClick={handleViewResults}>
            View Results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
