"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  EllipsisVertical,
  Columns3,
} from "lucide-react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"

import { useI18n } from "@/components/i18n-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Sheet,
  SheetContent,
  SheetDescription,
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

export type RecentLead = {
  id: string
  buyer: string
  product: string
  country: string
  receivedAt: string
  status: string
  lastMessage: string
  actionHref: string
}

function LeadCellViewer({ lead }: { lead: RecentLead }) {
  const isMobile = useIsMobile()
  const { t } = useI18n()

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="link" className="w-fit px-0 text-left text-foreground" />
        }
      >
        {lead.buyer}
      </SheetTrigger>
      <SheetContent side={isMobile ? "bottom" : "right"}>
        <SheetHeader className="gap-1">
          <SheetTitle>{lead.buyer}</SheetTitle>
          <SheetDescription>{lead.product}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm">
          <div className="grid gap-2">
            <span className="text-muted-foreground">{t("sellerDashboard.country")}</span>
            <span>{lead.country}</span>
          </div>
          <div className="grid gap-2">
            <span className="text-muted-foreground">{t("sellerDashboard.receivedAt")}</span>
            <span>{lead.receivedAt}</span>
          </div>
          <div className="grid gap-2">
            <span className="text-muted-foreground">{t("sellerDashboard.status")}</span>
            <Badge variant="outline" className="w-fit px-1.5 text-muted-foreground">
              {lead.status}
            </Badge>
          </div>
          <div className="grid gap-2">
            <span className="text-muted-foreground">{t("sellerDashboard.lastMessage")}</span>
            <p className="whitespace-pre-wrap">{lead.lastMessage}</p>
          </div>
          <Button render={<Link href={lead.actionHref} />}>
            {t("sellerDashboard.view")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function getColumns(t: (key: string) => string): ColumnDef<RecentLead>[] {
  return [
    {
      accessorKey: "buyer",
      header: t("sellerDashboard.buyer"),
      cell: ({ row }) => <LeadCellViewer lead={row.original} />,
      enableHiding: false,
    },
    {
      accessorKey: "product",
      header: t("sellerDashboard.product"),
      cell: ({ row }) => <div className="min-w-36">{row.original.product}</div>,
    },
    {
      accessorKey: "country",
      header: t("sellerDashboard.country"),
      cell: ({ row }) => <div className="min-w-28">{row.original.country}</div>,
    },
    {
      accessorKey: "receivedAt",
      header: t("sellerDashboard.receivedAt"),
      cell: ({ row }) => <div className="min-w-32">{row.original.receivedAt}</div>,
    },
    {
      accessorKey: "status",
      header: t("sellerDashboard.status"),
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "lastMessage",
      header: t("sellerDashboard.lastMessage"),
      cell: ({ row }) => (
        <div className="max-w-72 truncate text-muted-foreground">
          {row.original.lastMessage}
        </div>
      ),
    },
    {
      id: "action",
      header: t("sellerDashboard.action"),
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="flex size-8 text-muted-foreground aria-expanded:bg-muted"
                size="icon"
              />
            }
          >
            <EllipsisVertical />
            <span className="sr-only">{t("sellerDashboard.action")}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem render={<Link href={row.original.actionHref} />}>
              {t("sellerDashboard.view")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}

export function DataTable({
  data,
  status,
}: {
  data: RecentLead[]
  status: "loading" | "ready" | "error"
}) {
  const { t } = useI18n()
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const columns = React.useMemo(() => getColumns(t), [t])
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const emptyText =
    status === "loading"
      ? t("sellerDashboard.loading")
      : status === "error"
        ? t("sellerDashboard.loadError")
        : t("sellerDashboard.noLeads")

  return (
    <Tabs
      defaultValue="recent-leads"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          {t("sellerDashboard.recentLeads")}
        </Label>
        <Select defaultValue="recent-leads">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder={t("sellerDashboard.recentLeads")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent-leads">{t("sellerDashboard.recentLeads")}</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="hidden @4xl/main:flex">
          <TabsTrigger value="recent-leads">{t("sellerDashboard.recentLeads")}</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <Label htmlFor="lead-search" className="sr-only">
            {t("sellerDashboard.searchLeads")}
          </Label>
          <Input
            id="lead-search"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={t("sellerDashboard.searchLeads")}
            className="hidden w-44 sm:flex"
            disabled={status !== "ready"}
          />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={status !== "ready"} />}>
              <Columns3 />
              <span className="hidden lg:inline">{t("sellerDashboard.customizeColumns")}</span>
              <span className="lg:hidden">{t("sellerDashboard.columns")}</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {typeof column.columnDef.header === "string"
                      ? column.columnDef.header
                      : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <TabsContent
        value="recent-leads"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {status === "ready" && table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {emptyText}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {status === "ready"
              ? `${table.getFilteredRowModel().rows.length} ${t("sellerDashboard.leadCount")}`
              : null}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                {t("sellerDashboard.rowsPerPage")}
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
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
              {t("sellerDashboard.page")} {table.getState().pagination.pageIndex + 1} {t("sellerDashboard.of")} {Math.max(1, table.getPageCount())}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">{t("sellerDashboard.firstPage")}</span>
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">{t("sellerDashboard.previousPage")}</span>
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">{t("sellerDashboard.nextPage")}</span>
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">{t("sellerDashboard.lastPage")}</span>
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
