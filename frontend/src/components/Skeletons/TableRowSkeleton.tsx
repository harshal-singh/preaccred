/* eslint-disable react/no-array-index-key */
import {
  SkeletonItem,
  TableCell,
  TableCellProps,
  TableColumnDefinition,
  TableRow,
} from '@fluentui/react-components';
import { memo } from 'react';
import { v4 as uuid } from 'uuid';

const TableRowSkeleton = ({
  columns,
  cellProps,
}: {
  columns: TableColumnDefinition<never>[];
  cellProps: Omit<TableCellProps, 'children'> | undefined;
}) => {
  return Array.from({ length: 5 }).map((_, index) => (
    <TableRow key={uuid()} className="!border-none">
      {columns.map((column) => (
        <TableCell
          key={`${column.columnId}-${index}`}
          className="!p-0"
          {...cellProps}
        >
          <SkeletonItem shape="rectangle" className="!rounded-none" size={40} />
        </TableCell>
      ))}
    </TableRow>
  ));
};

export default memo(TableRowSkeleton);
