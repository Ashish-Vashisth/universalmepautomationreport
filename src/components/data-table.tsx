"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps<T extends object> {
  data: T[];
  title?: string;
  pageSize?: number;
}

function buildColumns<T extends object>(data: T[]): ColumnDef<T>[] {
  if (!data.length) return [];
  return Object.keys(data[0]).map((key) => ({
    id: key,
    accessorFn: (row: T) => (row as Record<string, unknown>)[key],
    header: key,
    cell: ({ getValue }) => {
      const v = getValue();
      if (v === null || v === undefined) return <span className="text-slate-300 dark:text-white/25">—</span>;
      return String(v);
    },
  }));
}

export function DataTable<T extends object>({
  data,
  title,
  pageSize = 20,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(() => buildColumns(data), [data]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  if (!data.length) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 dark:text-white/40 text-sm">
        No records found.
      </div>
    );
  }

  const SortIcon = ({ col }: { col: { getIsSorted: () => string | false } }) => {
    const sorted = col.getIsSorted();
    if (sorted === "asc") return <ChevronUp className="h-3.5 w-3.5 ml-1 text-[#ff4b4b]" />;
    if (sorted === "desc") return <ChevronDown className="h-3.5 w-3.5 ml-1 text-[#ff4b4b]" />;
    return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 text-slate-300 dark:text-white/25" />;
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {title && (
          <h3 className="text-slate-600 dark:text-white/70 text-sm font-semibold">{title}</h3>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Input
            placeholder="Filter records…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 w-48 text-xs bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus-visible:ring-[#ff4b4b]/40"
          />
          <span className="text-slate-400 dark:text-white/30 text-xs whitespace-nowrap">
            {table.getFilteredRowModel().rows.length} rows
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-auto max-h-[420px]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-slate-200 dark:border-white/10 hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-slate-600 dark:text-white/60 text-xs font-semibold whitespace-nowrap py-2.5 px-3 bg-slate-50 dark:bg-white/5 cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="inline-flex items-center">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon col={header.column} />
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "text-slate-700 dark:text-white/80 text-xs py-2 px-3 whitespace-nowrap",
                      // Highlight severity cells
                      String(cell.getValue()) === "HIGH" && "text-red-400 font-semibold",
                      String(cell.getValue()) === "MEDIUM" && "text-yellow-300 font-semibold",
                      String(cell.getValue()) === "LOW" && "text-green-400 font-semibold",
                      String(cell.getValue()) === "ZERO/INACTIVE SITE" && "text-red-400/80"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 dark:text-white/30 text-xs">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 w-7 text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-25"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 w-7 text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-25"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
