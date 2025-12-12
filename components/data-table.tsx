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

import { useIsMobile } from "@/hooks/use-mobile"
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
  getSeverityBadgeVariant,
  filterBySeverity,
} from "@/lib/audit-table-adapter"

const columns: ColumnDef<AuditTableRow>[] = [
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
    // NOTE: Ignore/Resolve actions are placeholders (planned for Phase 4).
    // These buttons are disabled and show "Coming soon" until backend functionality is implemented.
    // Users can still view issue details by clicking the issue title, which opens a Sheet sidebar.
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
            size="icon"
            onClick={(e) => {
              // Prevent row expansion when clicking actions
              e.stopPropagation()
            }}
            aria-label={`Actions for ${row.original.title}`}
          >
            <MoreVerticalIcon />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-40"
          onClick={(e) => {
            // Prevent row expansion when interacting with dropdown
            e.stopPropagation()
          }}
        >
          <DropdownMenuItem disabled>
            <XIcon className="mr-2 h-4 w-4" />
            Ignore Issue
            <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <CheckCircle2Icon className="mr-2 h-4 w-4" />
            Mark Resolved
            <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

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

                  {/* Evidence Section */}
                  {row.original.examples && row.original.examples.length > 0 && (
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
                  )}

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
}: {
  data: AuditTableRow[]
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
  const [isFiltering, setIsFiltering] = React.useState(false)
  const [globalFilter, setGlobalFilter] = React.useState("")

  // Filter data by severity
  const filteredData = React.useMemo(() => {
    return filterBySeverity(initialData, activeSeverityTab)
  }, [initialData, activeSeverityTab])

  // Reset pagination when severity filter changes
  React.useEffect(() => {
    setIsFiltering(true)
    const timer = setTimeout(() => {
      setPagination((prev) => ({ pageIndex: 0, pageSize: prev.pageSize }))
      setIsFiltering(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [activeSeverityTab])

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
      all: initialData.length,
      high: initialData.filter((item) => item.severity === "high").length,
      medium: initialData.filter((item) => item.severity === "medium").length,
      low: initialData.filter((item) => item.severity === "low").length,
    }
    return counts
  }, [initialData])

  return (
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
                        {activeSeverityTab === "all" 
                          ? "No issues found. Great job! ✅"
                          : `No ${activeSeverityTab} severity issues found. Great job! ✅`
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Your content audit found no issues{activeSeverityTab !== "all" && ` with ${activeSeverityTab} severity`}.
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
  const isMobile = useIsMobile()

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
          <SheetDescription>
            <Badge variant={getSeverityBadgeVariant(item.severity)} className="mt-1">
              {item.severity.toUpperCase()}
            </Badge>
          </SheetDescription>
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
