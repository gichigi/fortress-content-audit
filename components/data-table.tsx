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
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  getSeverityBadgeVariant,
  filterBySeverity,
} from "@/lib/audit-table-adapter"
import { IssueStatus } from "@/types/fortress"
import { createClient } from "@/lib/supabase-browser"
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
  onUpdateStatus?: (issueId: string, status: IssueStatus) => Promise<void>,
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
        return <div className="font-medium">{row.original.title}</div>
      },
      enableHiding: false,
    },
    {
      accessorKey: "severity",
      header: "Severity",
      cell: ({ row }) => {
        const severityLabel = row.original.severity === 'high' ? 'critical' : row.original.severity
        return (
          <Badge
            variant={getSeverityBadgeVariant(row.original.severity)}
            className="px-2 py-0.5 text-xs font-semibold uppercase"
          >
            {severityLabel}
          </Badge>
        )
      },
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
      accessorKey: "locations",
      header: () => <div className="w-full text-right">Pages</div>,
      cell: ({ row }) => {
        const locations = row.original.locations || []
        const locationCount = locations.length
        
        if (locationCount === 0) {
          return <div className="text-right text-sm text-muted-foreground">—</div>
        }
        
        if (locationCount === 1) {
          // Single page: show URL (truncated if long)
          const url = locations[0].url
          const maxLength = 50
          const displayUrl = url.length > maxLength ? `${url.substring(0, maxLength)}...` : url
          return (
            <div className="text-right">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline break-all"
                title={url}
                onClick={(e) => e.stopPropagation()}
              >
                {displayUrl}
              </a>
            </div>
          )
        }
        
        // Multiple pages: show count only (user can expand to see URLs)
        return (
          <div className="text-right font-medium">
            {locationCount} pages
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const issueId = row.original.id
        const currentStatus = row.original.status || 'active'
        
        // Issue status management available to all authenticated users
        if (!onUpdateStatus || !issueId) {
          return null
        }

        return (
          <IssueActionsDropdown
            issueId={issueId}
            currentStatus={currentStatus}
            onUpdateStatus={onUpdateStatus}
            currentStateTab={currentStateTab}
          />
        )
      },
    },
  ]
}

// Issue actions dropdown component
function IssueActionsDropdown({
  issueId,
  currentStatus,
  onUpdateStatus,
  currentStateTab,
}: {
  issueId: string
  currentStatus: IssueStatus
  onUpdateStatus: (issueId: string, status: IssueStatus) => Promise<void>
  currentStateTab?: 'active' | 'ignored' | 'resolved' | 'all'
}) {
  const [ignoreDialogOpen, setIgnoreDialogOpen] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)

  const handleIgnore = async () => {
    setIsUpdating(true)
    try {
      await onUpdateStatus(issueId, 'ignored')
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
      await onUpdateStatus(issueId, 'resolved')
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
      await onUpdateStatus(issueId, 'active')
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
          {currentStatus === 'active' && (
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
          {(currentStatus === 'ignored' || currentStatus === 'resolved') && (
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

// Expandable row component for showing locations and details
function ExpandableRow({ row }: { row: Row<AuditTableRow> }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const locationCount = row.original.locations?.length || 0
  const isMultiLocation = locationCount > 1

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
        className={isMultiLocation ? "cursor-pointer hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2" : ""}
        onClick={isMultiLocation ? handleToggle : undefined}
        onKeyDown={isMultiLocation ? handleToggle : undefined}
        aria-expanded={isMultiLocation ? isOpen : undefined}
        aria-controls={isMultiLocation ? `expanded-${row.id}` : undefined}
        tabIndex={isMultiLocation ? 0 : undefined}
        role={isMultiLocation ? "button" : undefined}
      >
        {row.getVisibleCells().map((cell) => {
          // In the Issue/Title column, show chevron for multi-location issues
          if (cell.column.id === 'title' && isMultiLocation) {
            return (
              <TableCell key={cell.id}>
                <div className="flex items-center gap-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  <ChevronDownIcon className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </TableCell>
            )
          }
          return <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
        })}
      </TableRow>
      {/* Only multi-location issues expand to show locations list */}
      {isOpen && isMultiLocation && (
        <TableRow>
          <TableCell colSpan={row.getVisibleCells().length} className="bg-muted/30 pl-8">
            <ul className="space-y-2 py-2">
              {row.original.locations.map((loc, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={loc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary hover:underline break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {loc.url}
                  </a>
                  <span className="ml-2 italic text-foreground/80">"{loc.snippet}"</span>
                </li>
              ))}
            </ul>
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
  // Sort by severity by default: Critical → Medium → Low
  const severityOrder = { high: 0, medium: 1, low: 2 }
  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: "severity",
      desc: false, // Ascending: Critical first
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
  const [data, setData] = React.useState(initialData)
  // Store initial data in ref to avoid dependency issues
  const initialDataRef = React.useRef(initialData)

  // Update data and ref when initialData changes
  React.useEffect(() => {
    initialDataRef.current = initialData
    setData(initialData)
  }, [initialData])

  // Update issue status handler with optimistic updates
  const handleUpdateStatus = React.useCallback(async (issueId: string, newStatus: IssueStatus) => {
    if (!auditId) {
      throw new Error('Audit ID required')
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Not authenticated')
    }

    // Store previous state for potential revert
    let previousData: AuditTableRow[] | null = null

    // Optimistic update
    setData(prevData => {
      previousData = prevData
      return prevData.map(item => 
        item.id === issueId ? { ...item, status: newStatus } : item
      )
    })

    try {
      const response = await fetch(`/api/audit/${auditId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        if (previousData) {
          setData(previousData)
        } else {
          setData(initialDataRef.current)
        }
        const error = await response.json().catch(() => ({ error: 'Failed to update status' }))
        throw new Error(error.error || 'Failed to update status')
      }
    } catch (error) {
      // Revert optimistic update on error
      if (previousData) {
        setData(previousData)
      } else {
        setData(initialDataRef.current)
      }
      throw error
    }
  }, [auditId])

  // Filter data by status first, then by severity
  const filteredByState = React.useMemo(() => {
    if (activeStateTab === 'all') {
      return data
    }
    return data.filter((row) => {
      const status = row.status || 'active'
      return status === activeStateTab
    })
  }, [data, activeStateTab])

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
      const matchesTitle = row.title.toLowerCase().includes(searchLower)
      const matchesImpact = row.impact?.toLowerCase().includes(searchLower) || false
      const matchesFix = row.fix?.toLowerCase().includes(searchLower) || false
      
      // Search locations array
      const matchesLocations = row.locations?.some(loc => 
        loc.url.toLowerCase().includes(searchLower) ||
        loc.snippet.toLowerCase().includes(searchLower)
      ) || false
      
      return matchesTitle || matchesImpact || matchesFix || matchesLocations
    })
  }, [filteredData, globalFilter])

  // Create columns with status handlers
  const columns = React.useMemo(
    () => createColumns(handleUpdateStatus, userPlan, activeStateTab),
    [handleUpdateStatus, userPlan, activeStateTab]
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
      all: data.length,
      active: data.filter((item) => (item.status || 'active') === 'active').length,
      ignored: data.filter((item) => item.status === 'ignored').length,
      resolved: data.filter((item) => item.status === 'resolved').length,
    }
    return counts
  }, [data])

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
            <SelectItem value="high">Critical</SelectItem>
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
            Critical{" "}
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
                    const mobileHeader = headerId === 'locations' ? 'Loc.' : 
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
                Showing {table.getFilteredRowModel().rows.length} of {data.length} issue{table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
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

