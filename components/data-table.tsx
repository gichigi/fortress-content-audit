"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronsUpDownIcon,
  ColumnsIcon,
  EyeIcon,
  Loader2,
  MoreVerticalIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useMobile } from "@/hooks/use-mobile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  AuditTableRow,
  AuditIssueGroup,
  getSeverityBadgeVariant,
  filterBySeverity,
} from "@/lib/audit-table-adapter"
import { IssueState } from "@/types/fortress"
import { createClient } from "@/lib/supabase-browser"
import { generateIssueSignature } from "@/lib/issue-signature"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RotateCcwIcon } from "lucide-react"

// Create columns factory function to accept state update handlers
function createColumns(
  onUpdateState?: (signature: string, state: IssueState) => Promise<void>,
  userPlan?: string,
  currentStateTab?: 'active' | 'ignored' | 'resolved' | 'all'
): ColumnDef<AuditTableRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "title",
      header: "Issue",
      cell: ({ row }) => {
        return <TableCellViewer item={row.original} />
      },
      enableHiding: false,
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const category = row.original.category
        if (!category) return null
        return (
          <Badge variant="outline" className="text-xs">
            {category}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        const category = row.original.category || ''
        return category.toLowerCase().includes(value.toLowerCase())
      },
    },
    {
      accessorKey: "severity",
      header: "Severity",
      cell: ({ row }) => (
        <Badge
          variant={getSeverityBadgeVariant(row.original.severity)}
          className="px-2 py-0.5 text-xs font-semibold uppercase"
        >
          {row.original.severity}
        </Badge>
      ),
      sortingFn: (rowA, rowB) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[rowA.original.severity] - order[rowB.original.severity]
      },
    },
    {
      accessorKey: "impact",
      header: "Impact",
      cell: ({ row }) => (
        <div className="max-w-md truncate text-sm text-muted-foreground">
          {row.original.impact}
        </div>
      ),
    },
    {
      accessorKey: "count",
      header: () => <div className="w-full text-right">Instances</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">{row.original.count}</div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const signature = row.original.signature
        const currentState = row.original.state || 'active'
        
        // Issue state management available to all authenticated users
        if (!onUpdateState || !signature) {
          return null
        }

        return (
          <IssueActionsDropdown
            signature={signature}
            currentState={currentState}
            onUpdateState={onUpdateState}
            currentStateTab={currentStateTab}
          />
        )
      },
    },
  ]
}

// Issue actions dropdown component
function IssueActionsDropdown({
  signature,
  currentState,
  onUpdateState,
  currentStateTab,
}: {
  signature: string
  currentState: IssueState
  onUpdateState: (signature: string, state: IssueState) => Promise<void>
  currentStateTab?: 'active' | 'ignored' | 'resolved' | 'all'
}) {
  const [ignoreDialogOpen, setIgnoreDialogOpen] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)

  const handleIgnore = async () => {
    setIsUpdating(true)
    try {
      await onUpdateState(signature, 'ignored')
      setIgnoreDialogOpen(false)
      toast.success('Issue ignored')
    } catch (error) {
      toast.error('Failed to ignore issue')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleResolve = async () => {
    setIsUpdating(true)
    try {
      await onUpdateState(signature, 'resolved')
      toast.success('Issue marked as resolved')
    } catch (error) {
      toast.error('Failed to resolve issue')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRestore = async () => {
    setIsUpdating(true)
    try {
      await onUpdateState(signature, 'active')
      toast.success('Issue restored')
    } catch (error) {
      toast.error('Failed to restore issue')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
            size="icon"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Actions for issue`}
            disabled={isUpdating}
          >
            <MoreVerticalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-40"
          onClick={(e) => e.stopPropagation()}
        >
          {currentState === 'active' && (
            <>
              <DropdownMenuItem onClick={() => setIgnoreDialogOpen(true)}>
                <XIcon className="mr-2 h-4 w-4" />
                Ignore Issue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleResolve}>
                <CheckCircle2Icon className="mr-2 h-4 w-4" />
                Mark Resolved
              </DropdownMenuItem>
            </>
          )}
          {(currentState === 'ignored' || currentState === 'resolved') && (
            <DropdownMenuItem onClick={handleRestore}>
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              Restore
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={ignoreDialogOpen} onOpenChange={setIgnoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignore Issue</AlertDialogTitle>
            <AlertDialogDescription>
              This issue will be hidden from future audits and won't appear in your active issues list. You can restore it later from the Ignored tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleIgnore} disabled={isUpdating}>
              {isUpdating ? 'Ignoring...' : 'Ignore Issue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Expandable row component for showing evidence and fix
function ExpandableRow({ row }: { row: Row<AuditTableRow> }) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Don't toggle if clicking on interactive elements
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('a') || target.closest('[role="menu"]')) {
      return
    }
    // Allow keyboard activation (Enter or Space)
    if (e.type === 'keydown') {
      const keyEvent = e as React.KeyboardEvent
      if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') {
        return
      }
      keyEvent.preventDefault()
    }
    setIsOpen(!isOpen)
  }

  return (
    <>
      <TableRow
        data-state={row.getIsSelected() && "selected"}
        data-expanded={isOpen}
        className="cursor-pointer hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        onClick={handleToggle}
        onKeyDown={handleToggle}
        aria-expanded={isOpen}
        aria-controls={`expanded-${row.id}`}
        tabIndex={0}
        role="button"
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
      {isOpen && (
        <TableRow aria-labelledby={`row-${row.id}`}>
          <TableCell colSpan={row.getVisibleCells().length} className="p-0 bg-muted/30">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleContent 
                id={`expanded-${row.id}`}
                className="bg-muted/30"
              >
                <div className="p-6 space-y-6">
                  {/* Impact Section */}
                  <div>
                    <div className="flex items-start gap-4 mb-4">
                      <AlertCircleIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <h4 className="text-sm font-serif font-semibold mb-2">Business Impact</h4>
                        <p className="text-sm text-muted-foreground">{row.original.impact}</p>
                      </div>
                    </div>
                  </div>

                  {/* Evidence Section - Show instances if available, otherwise show examples */}
                  {row.original.instances && row.original.instances.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-serif font-semibold mb-4">Instances Found ({row.original.instances.length})</h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {row.original.instances.slice(0, 20).map((instance, idx) => (
                          <Card key={idx} className="border">
                            <CardContent className="p-3">
                              <p className="text-sm text-foreground/80 italic mb-2 leading-relaxed">
                                "{instance.snippet}"
                              </p>
                              <a
                                href={instance.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors break-all"
                              >
                                {instance.url}
                              </a>
                            </CardContent>
                          </Card>
                        ))}
                        {row.original.instances.length > 20 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            Showing first 20 of {row.original.instances.length} instances
                          </p>
                        )}
                      </div>
                    </div>
                  ) : row.original.examples && row.original.examples.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-serif font-semibold mb-4">Evidence Found</h4>
                      <div className="space-y-4">
                        {row.original.examples.map((example, idx) => (
                          <Card key={idx} className="border">
                            <CardContent className="p-4">
                              <p className="text-sm text-foreground/80 italic mb-2 leading-relaxed">
                                "{example.snippet}"
                              </p>
                              <a
                                href={example.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
                              >
                                {example.url}
                              </a>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Fix/Recommendation Section */}
                  {row.original.fix && (
                    <div>
                      <div className="flex items-start gap-4">
                        <SparklesIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <h4 className="text-sm font-serif font-semibold mb-2">Recommendation</h4>
                          <p className="text-sm text-foreground">{row.original.fix}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function DataTable({
  data: initialData,
  auditId,
  userPlan,
}: {
  data: AuditTableRow[]
  auditId?: string
  userPlan?: string
}) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  // Sort by severity by default: High → Medium → Low
  const severityOrder = { high: 0, medium: 1, low: 2 }
  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: "severity",
      desc: false, // Ascending: High first
    },
  ])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [activeSeverityTab, setActiveSeverityTab] = React.useState<"all" | "high" | "medium" | "low">("all")
  const [activeStateTab, setActiveStateTab] = React.useState<'all' | 'active' | 'ignored' | 'resolved'>('all')
  const [isFiltering, setIsFiltering] = React.useState(false)
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [issueStates, setIssueStates] = React.useState<Map<string, IssueState>>(new Map())
  const [isLoadingStates, setIsLoadingStates] = React.useState(false)

  // Fetch issue states on mount if auditId and user are available
  // Available to all authenticated users (free, paid, enterprise)
  React.useEffect(() => {
    if (!auditId || !userPlan) return

    const fetchIssueStates = async () => {
      setIsLoadingStates(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        // Fetch audit to get domain
        const auditResponse = await fetch(`/api/audit/${auditId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })

        if (!auditResponse.ok) return
        const audit = await auditResponse.json()
        if (!audit.domain) return

        // Fetch issue states for this audit's domain
        const { data: states, error } = await supabase
          .from('audit_issue_states')
          .select('signature, state')
          .eq('domain', audit.domain)

        if (error) {
          console.error('Error fetching issue states:', error)
          return
        }

        // Convert to Map
        const statesMap = new Map<string, IssueState>()
        states?.forEach((s) => {
          if (s.signature && s.state) {
            statesMap.set(s.signature, s.state as IssueState)
          }
        })
        setIssueStates(statesMap)
      } catch (error) {
        console.error('Error fetching issue states:', error)
      } finally {
        setIsLoadingStates(false)
      }
    }

    fetchIssueStates()
  }, [auditId, userPlan])

  // Update issue state handler
  // Use functional setState to avoid stale closures - don't include issueStates in dependencies
  const handleUpdateState = React.useCallback(async (signature: string, newState: IssueState) => {
    if (!auditId) {
      throw new Error('Audit ID required')
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Not authenticated')
    }

    // Capture original state and apply optimistic update in one operation
    let originalState: IssueState = 'active'
    setIssueStates((prev) => {
      originalState = prev.get(signature) || 'active'
      const next = new Map(prev)
      next.set(signature, newState)
      return next
    })

    try {
      const response = await fetch(`/api/audit/${auditId}/issues/${signature}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ state: newState }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to update state' }))
        // Revert optimistic update on error
        setIssueStates((prev) => {
          const next = new Map(prev)
          next.set(signature, originalState)
          return next
        })
        throw new Error(error.error || 'Failed to update state')
      }

      // Optimistic update already set the state correctly
    } catch (error) {
      // Error already handled above with revert
      throw error
    }
  }, [auditId])

  // Merge issue states with row data
  // Generate signatures if missing (e.g., when initialData comes from transformAuditToTableRows without states)
  const dataWithStates = React.useMemo(() => {
    return initialData.map((row) => {
      // Use existing signature or generate from row data
      let signature = row.signature
      if (!signature && row.title && row.examples?.[0]?.url) {
        // Generate signature if missing
        try {
          signature = generateIssueSignature({
            title: row.title,
            severity: row.severity,
            impact: row.impact,
            fix: row.fix,
            examples: row.examples,
            count: row.count,
          } as AuditIssueGroup)
        } catch {
          // Fallback to row.id if generation fails
          signature = row.id
        }
      } else if (!signature) {
        signature = row.id
      }
      
      const state = issueStates.get(signature) || 'active'
      return {
        ...row,
        state,
        signature,
      }
    })
  }, [initialData, issueStates])

  // Filter data by state first, then by severity
  const filteredByState = React.useMemo(() => {
    if (activeStateTab === 'all') {
      return dataWithStates
    }
    return dataWithStates.filter((row) => {
      const state = row.state || 'active'
      return state === activeStateTab
    })
  }, [dataWithStates, activeStateTab])

  // Filter data by severity
  const filteredData = React.useMemo(() => {
    return filterBySeverity(filteredByState, activeSeverityTab)
  }, [filteredByState, activeSeverityTab])

  // Reset pagination when severity or state filter changes
  React.useEffect(() => {
    setIsFiltering(true)
    const timer = setTimeout(() => {
      setPagination((prev) => ({ pageIndex: 0, pageSize: prev.pageSize }))
      setIsFiltering(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [activeSeverityTab, activeStateTab])

  // Apply global filter (search) to filtered data
  const searchFilteredData = React.useMemo(() => {
    if (!globalFilter.trim()) return filteredData
    const searchLower = globalFilter.toLowerCase()
    return filteredData.filter((row) => {
      return (
        row.title.toLowerCase().includes(searchLower) ||
        row.impact.toLowerCase().includes(searchLower) ||
        (row.fix && row.fix.toLowerCase().includes(searchLower))
      )
    })
  }, [filteredData, globalFilter])

  // Create columns with state handlers
  const columns = React.useMemo(
    () => createColumns(handleUpdateState, userPlan, activeStateTab),
    [handleUpdateState, userPlan, activeStateTab]
  )

  const table = useReactTable({
    data: searchFilteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
      globalFilter,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Count issues by severity for tabs
  const severityCounts = React.useMemo(() => {
    const counts = {
      all: filteredByState.length,
      high: filteredByState.filter((item) => item.severity === "high").length,
      medium: filteredByState.filter((item) => item.severity === "medium").length,
      low: filteredByState.filter((item) => item.severity === "low").length,
    }
    return counts
  }, [filteredByState])

  // Count issues by state for state tabs
  const stateCounts = React.useMemo(() => {
    const counts = {
      all: dataWithStates.length,
      active: dataWithStates.filter((item) => (item.state || 'active') === 'active').length,
      ignored: dataWithStates.filter((item) => item.state === 'ignored').length,
      resolved: dataWithStates.filter((item) => item.state === 'resolved').length,
    }
    return counts
  }, [dataWithStates])

  return (
    <div className="flex w-full flex-col justify-start gap-6">
      {/* State Tabs (Active/Ignored/Resolved) - available to all authenticated users */}
      {userPlan && (
        <Tabs
          value={activeStateTab}
          onValueChange={(value) => {
            setActiveStateTab(value as 'all' | 'active' | 'ignored' | 'resolved')
          }}
          className="w-full"
        >
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all">
              All Issues
              {stateCounts.all > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 flex h-5 w-5 items-center justify-center bg-muted-foreground/30"
                >
                  {stateCounts.all}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">
              Active
              {stateCounts.active > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 flex h-5 w-5 items-center justify-center bg-muted-foreground/30"
                >
                  {stateCounts.active}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ignored">
              Ignored
              {stateCounts.ignored > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 flex h-5 w-5 items-center justify-center bg-muted-foreground/30"
                >
                  {stateCounts.ignored}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved
              {stateCounts.resolved > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 flex h-5 w-5 items-center justify-center bg-muted-foreground/30"
                >
                  {stateCounts.resolved}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Severity Tabs */}
      <Tabs
        value={activeSeverityTab}
        onValueChange={(value) => {
          setActiveSeverityTab(value as "all" | "high" | "medium" | "low")
          // Pagination reset handled in useEffect above
        }}
        className="flex w-full flex-col justify-start gap-6"
      >
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Label htmlFor="severity-selector" className="sr-only">
              Filter by Severity
            </Label>
            <Select 
          value={activeSeverityTab} 
          onValueChange={(value) => {
            setActiveSeverityTab(value as "all" | "high" | "medium" | "low")
            // Pagination reset handled in useEffect above
          }}
        >
          <SelectTrigger
            className="@4xl/main:hidden flex w-fit"
            id="severity-selector"
          >
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Issues</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="@4xl/main:flex hidden">
          <TabsTrigger value="all">
            All Issues{" "}
            {severityCounts.all > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 flex h-5 w-5 items-center justify-center bg-muted-foreground/30"
              >
                {severityCounts.all}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="high" className="gap-1">
            High{" "}
            {severityCounts.high > 0 && (
              <Badge
                variant="secondary"
                className="flex h-5 w-5 items-center justify-center bg-muted-foreground/30"
              >
                {severityCounts.high}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="medium" className="gap-1">
            Medium{" "}
            {severityCounts.medium > 0 && (
              <Badge
                variant="secondary"
                className="flex h-5 w-5 items-center justify-center bg-muted-foreground/30"
              >
                {severityCounts.medium}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="low">
            Low{" "}
            {severityCounts.low > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 flex h-5 w-5 items-center justify-center bg-muted-foreground/30"
              >
                {severityCounts.low}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
        </div>
        {/* Clear Selection Button */}
        {table.getFilteredSelectedRowModel().rows.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.toggleAllPageRowsSelected(false)}
            >
              Clear Selection ({table.getFilteredSelectedRowModel().rows.length})
            </Button>
          </div>
        )}
      </div>
      <TabsContent
        value={activeSeverityTab}
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        {isFiltering ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Filtering...</span>
          </div>
        ) : (
        <div className="overflow-hidden border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    // Mobile-friendly headers: abbreviate long labels
                    const headerId = header.id || ''
                    const mobileHeader = headerId === 'count' ? 'Inst.' : 
                                        headerId === 'severity' ? 'Sev.' :
                                        headerId
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : (
                          <>
                            <span className="hidden md:inline">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                            {mobileHeader && (
                              <span className="md:hidden text-xs">
                                {mobileHeader}
                              </span>
                            )}
                          </>
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <ExpandableRow key={row.id} row={row} />
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center py-8"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm font-medium text-foreground">
                        {activeStateTab !== 'all' && activeStateTab !== 'active'
                          ? `No ${activeStateTab} issues found`
                          : activeSeverityTab === "all" 
                            ? "No issues found. Great job! ✅"
                            : `No ${activeSeverityTab} severity issues found. Great job! ✅`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeStateTab !== 'all' && activeStateTab !== 'active'
                          ? `Switch to a different tab to see issues.`
                          : `Your content audit found no issues${activeSeverityTab !== "all" && ` with ${activeSeverityTab} severity`}.`
                        }
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        )}
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length > 0 ? (
              <>
                {table.getFilteredSelectedRowModel().rows.length} of{" "}
                {table.getFilteredRowModel().rows.length} row(s) selected.
              </>
            ) : (
              <>
                Showing {table.getFilteredRowModel().rows.length} of {initialData.length} issue{table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
                {activeSeverityTab !== "all" && ` (filtered by ${activeSeverityTab} severity)`}
              </>
            )}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      </Tabs>
    </div>
  )
}

const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--primary)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function TableCellViewer({ item }: { item: AuditTableRow }) {
  const isMobile = useMobile()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground">
          {item.title}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader className="gap-1">
          <SheetTitle className="font-serif">{item.title}</SheetTitle>
          <div className="mt-1">
            <Badge variant={getSeverityBadgeVariant(item.severity)}>
              {item.severity.toUpperCase()}
            </Badge>
          </div>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto py-4 text-sm">
          {/* Impact Section */}
          <div>
            <h4 className="text-sm font-serif font-semibold mb-2">Business Impact</h4>
            <p className="text-sm text-muted-foreground">{item.impact}</p>
          </div>

          <Separator />

          {/* Evidence Section */}
          {item.examples && item.examples.length > 0 && (
            <div>
              <h4 className="text-sm font-serif font-semibold mb-4">Evidence Found</h4>
              <div className="space-y-4">
                {item.examples.map((example, idx) => (
                  <Card key={idx} className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-foreground/80 italic mb-2 leading-relaxed">
                        "{example.snippet}"
                      </p>
                      <a
                        href={example.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors break-all"
                      >
                        {example.url}
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Fix/Recommendation Section */}
          {item.fix && (
            <div>
              <div className="flex items-start gap-2 mb-2">
                <SparklesIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <h4 className="text-sm font-serif font-semibold">Recommendation</h4>
              </div>
              <p className="text-sm text-foreground">{item.fix}</p>
            </div>
          )}

          <Separator />

          {/* Instance Count */}
          <div>
            <p className="text-xs text-muted-foreground">
              Found {item.count} instance{item.count !== 1 ? "s" : ""} across scanned pages
            </p>
          </div>
        </div>
        <SheetFooter className="mt-auto flex gap-2 sm:flex-col sm:space-x-0">
          <SheetClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
