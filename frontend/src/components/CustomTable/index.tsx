/* eslint-disable react/no-array-index-key */
/* eslint-disable use-encapsulation/prefer-custom-hooks */
import {
  SkeletonItem,
  Table,
  TableBody,
  TableBodyProps,
  TableCell,
  TableCellProps,
  TableColumnDefinition,
  TableColumnId,
  TableColumnSizingOptions,
  TableHeader,
  TableHeaderCell,
  TableHeaderCellProps,
  TableHeaderProps,
  TableProps,
  TableRow,
  TableRowProps,
  useTableColumnSizing_unstable,
  useTableFeatures,
  useTableSort,
} from '@fluentui/react-components';
import {
  FetchNextPageOptions,
  InfiniteQueryObserverResult,
} from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { v4 as uuid } from 'uuid';

import TableRowSkeleton from 'components/Skeletons/TableRowSkeleton';

const TableComponent = ({
  items,
  columns,
  columnSizingOptions,
  tableProps,
  bodyProps,
  headerProps,
  headerCellProps,
  cellProps,
  rowProps,
  isLoading,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  isError,
  error,
}: {
  items: unknown[];
  columns: TableColumnDefinition<never>[];
  columnSizingOptions: TableColumnSizingOptions;
  tableProps?: Omit<TableProps, 'children'>;
  bodyProps?: Omit<TableBodyProps, 'children' | 'height'>;
  headerProps?: Omit<TableHeaderProps, 'children'>;
  headerCellProps?: Omit<TableHeaderCellProps, 'children'>;
  cellProps?: Omit<TableCellProps, 'children'>;
  rowProps?: Omit<TableRowProps, 'children'>;
  isLoading?: boolean;
  hasNextPage: boolean;
  fetchNextPage: (
    options?: FetchNextPageOptions,
  ) => Promise<InfiniteQueryObserverResult<unknown>>;
  isFetchingNextPage: boolean;
  isError: boolean;
  error: Error | null;
}) => {
  const { ref, inView } = useInView({
    rootMargin: `0px`,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, inView, isFetchingNextPage]);

  const {
    getRows,
    sort: { getSortDirection, toggleColumnSort, sort },
    columnSizing_unstable: columnSizingUnstable,
    tableRef,
  } = useTableFeatures(
    {
      columns,
      items: items as never[],
    },
    [
      useTableSort({
        defaultSortState: { sortColumn: 'file', sortDirection: 'ascending' },
      }),
      useTableColumnSizing_unstable({ columnSizingOptions }),
    ],
  );

  const headerSortProps = useCallback(
    (columnId: TableColumnId) => {
      return {
        onClick: (e: React.MouseEvent) => {
          toggleColumnSort(e, columnId);
        },
        sortDirection: getSortDirection(columnId),
      };
    },
    [getSortDirection, toggleColumnSort],
  );

  const rows = useMemo(() => sort(getRows()), [getRows, sort]);

  if (isError) {
    return <span>{error?.name}</span>;
  }

  return (
    <div className="overflow-x-auto">
      <Table
        sortable
        ref={tableRef}
        {...tableProps}
        {...columnSizingUnstable.getTableProps()}
      >
        <TableHeader {...headerProps}>
          <TableRow {...rowProps}>
            {columns.map((column) => (
              <TableHeaderCell
                key={column.columnId}
                {...headerCellProps}
                {...headerSortProps(column.columnId)}
                {...columnSizingUnstable.getTableHeaderCellProps(
                  column.columnId,
                )}
              >
                {column.renderHeaderCell()}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody {...bodyProps}>
          {isLoading ? (
            <TableRowSkeleton columns={columns} cellProps={cellProps} />
          ) : (
            rows.map(({ item }, index) => {
              const data: { id: string } = item;

              if (index === rows.length - 20) {
                return (
                  <TableRow ref={ref} key={`${data.id}-${index}`}>
                    {columns.map((column) => (
                      <TableCell
                        key={uuid()}
                        {...cellProps}
                        {...columnSizingUnstable.getTableCellProps(
                          column.columnId,
                        )}
                      >
                        {column.renderCell(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              }

              return (
                <TableRow key={`${data.id}-${index}`}>
                  {columns.map((column) => (
                    <TableCell
                      key={uuid()}
                      {...cellProps}
                      {...columnSizingUnstable.getTableCellProps(
                        column.columnId,
                      )}
                    >
                      {column.renderCell(item)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
          {hasNextPage && isFetchingNextPage && (
            <TableRowSkeleton columns={columns} cellProps={cellProps} />
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const CustomTable = memo(TableComponent);

export default CustomTable;
