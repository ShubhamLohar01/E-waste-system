import { ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function DataTable({
  data,
  columns,
  onRowClick,
  pagination = true,
  pageSize = 10,
}) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(0);

  const handleSort = (header) => {
    if (sortColumn === header) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(header);
      setSortDirection('asc');
    }
  };

  let sortedData = [...data];
  if (sortColumn) {
    sortedData.sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const paginatedData = pagination
    ? sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedData;

  const totalPages = pagination ? Math.ceil(sortedData.length / pageSize) : 1;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted border-b border-border">
            <tr>
              {columns.map((column) => (
                <th
                  key={typeof column.accessor === 'string' ? column.accessor : column.header}
                  className={`px-6 py-3 text-left text-sm font-semibold text-foreground ${
                    column.sortable ? 'cursor-pointer hover:bg-muted/80' : ''
                  } ${column.width || ''}`}
                  onClick={() => column.sortable && handleSort(column.header)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && sortColumn === column.header && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-muted-foreground"
                >
                  No data available
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-t border-border hover:bg-muted/50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td
                      key={typeof column.accessor === 'string' ? column.accessor : column.header}
                      className="px-6 py-4 text-sm text-foreground"
                    >
                      {typeof column.accessor === 'function'
                        ? column.accessor(row)
                        : row[column.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
