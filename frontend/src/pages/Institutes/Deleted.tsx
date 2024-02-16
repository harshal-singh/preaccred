import {
  Button,
  Link,
  TableCellLayout,
  TableColumnDefinition,
  TableColumnSizingOptions,
  Tooltip,
} from '@fluentui/react-components';
import { Filter16Filled, DismissCircle16Regular } from '@fluentui/react-icons';
import { ModelTypes } from 'api/zeus';
import {
  isDeleteDrawerOpenAtom,
  isAddDrawerOpenAtom,
  isUpdateDrawerOpenAtom,
} from 'atoms';
import { useAtomValue } from 'jotai';
import { memo, useMemo } from 'react';

import { CustomBreadcrumbProps } from 'components/CustomBreadcrumb';
import CustomSearchBox from 'components/CustomSearchBox';
import CustomTable from 'components/CustomTable';
import DeleteDrawer from 'components/DeleteDrawer';
import PageLayout from 'components/PageLayout';
import AddInstituteDrawer from 'components/Pages/Institute/AddDrawer';
import UpdateInstituteDrawer from 'components/Pages/Institute/UpdateDrawer';

import useDeleteInstitute from 'hooks/Institute/useDelete';
import useActiveInstitutes from 'hooks/Institute/useGetDeleted';

import compareDates from 'helpers/compareDates';
import compareString from 'helpers/compareString';
import toLocalDateAndTime from 'helpers/toLocalDateAndTime';

const breadcrumbProps: CustomBreadcrumbProps = {
  links: [
    { name: 'home', url: '/' },
    { name: 'institutes', url: '/institutes/verification' },
    { name: 'deleted institutes', url: '/institutes/deleted' },
  ],
};

const columnSizingOptions: TableColumnSizingOptions = {
  name: {
    idealWidth: 200,
  },
  type: {
    idealWidth: 200,
  },
  dateOfEstablishment: {
    idealWidth: 200,
  },
  website: {
    idealWidth: 200,
  },
  address: {
    idealWidth: 200,
  },
  createAt: {
    idealWidth: 200,
  },
};

const getName = (): TableColumnDefinition<ModelTypes['Institute']> => {
  return {
    columnId: 'name',
    compare: (a, b) => compareString(a.name, b.name),
    renderHeaderCell: (data) => 'Name',
    renderCell: (item) => (
      <Tooltip content={item.name} relationship="inaccessible" withArrow>
        <TableCellLayout truncate>{item.name}</TableCellLayout>
      </Tooltip>
    ),
  };
};

const getVerificationStatus = (): TableColumnDefinition<
  ModelTypes['Institute']
> => {
  return {
    columnId: 'isVerified',
    compare: (a, b) => 0,
    renderHeaderCell: (data) => 'verification status',
    renderCell: (item) => (
      <TableCellLayout>
        <span className="flex items-center">
          <DismissCircle16Regular className="text-gray120 mr-2" />
          Rejected
        </span>
      </TableCellLayout>
    ),
  };
};

const getType = (): TableColumnDefinition<ModelTypes['Institute']> => {
  return {
    columnId: 'type',
    compare: (a, b) => compareString(a.type, b.type),
    renderHeaderCell: (data) => 'Type',
    renderCell: (item) => (
      <Tooltip content={item.type} relationship="inaccessible" withArrow>
        <TableCellLayout truncate>{item.type}</TableCellLayout>
      </Tooltip>
    ),
  };
};

const getDateOfEstablishment = (): TableColumnDefinition<
  ModelTypes['Institute']
> => {
  return {
    columnId: 'dateOfEstablishment',
    compare: (a, b) =>
      compareString(
        a.dateOfEstablishment as string,
        b.dateOfEstablishment as string,
      ),
    renderHeaderCell: (data) => 'Date Of Establishment',
    renderCell: (item) => (
      <Tooltip
        content={item.dateOfEstablishment as string}
        relationship="inaccessible"
        withArrow
      >
        <TableCellLayout truncate>{item.dateOfEstablishment}</TableCellLayout>
      </Tooltip>
    ),
  };
};

const getWebsite = (): TableColumnDefinition<ModelTypes['Institute']> => {
  return {
    columnId: 'website',
    compare: (a, b) => compareString(a.website, b.website),
    renderHeaderCell: (data) => 'Website',
    renderCell: (item) => (
      <Tooltip content={item.website} relationship="inaccessible" withArrow>
        <TableCellLayout truncate>
          <Link
            href={item.website}
            target="_blank"
            rel="noopener"
            referrerPolicy="no-referrer"
          >
            {item.website}
          </Link>
        </TableCellLayout>
      </Tooltip>
    ),
  };
};

const getAddress = (): TableColumnDefinition<ModelTypes['Institute']> => {
  return {
    columnId: 'address',
    compare: (a, b) =>
      compareString(
        `${a.address}, ${a.landmark}, ${a.city}, ${a.state} ${a.pin}`,
        `${b.address}, ${a.landmark}, ${a.city}, ${a.state} ${a.pin}`,
      ),
    renderHeaderCell: (data) => 'Address',
    renderCell: (item) => (
      <Tooltip
        content={`${item.address}, ${item.landmark}, ${item.city}, ${item.state} ${item.pin}`}
        relationship="inaccessible"
        withArrow
      >
        <TableCellLayout
          truncate
        >{`${item.address}, ${item.landmark}, ${item.city}, ${item.state} ${item.pin}`}</TableCellLayout>
      </Tooltip>
    ),
  };
};

const getCreateAt = (): TableColumnDefinition<ModelTypes['Institute']> => {
  return {
    columnId: 'createdAt',
    compare: (a, b) =>
      compareDates(a.createdAt as string, b.createdAt as string),
    renderHeaderCell: (data) => 'Created At',
    renderCell: (item) => (
      <TableCellLayout truncate>
        {item.createdAt && toLocalDateAndTime(item.createdAt as string)}
      </TableCellLayout>
    ),
  };
};

const useTableProps = () => {
  const {
    institutes,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
    isError,
  } = useActiveInstitutes();

  const columns: TableColumnDefinition<ModelTypes['Institute']>[] = useMemo(
    () => [
      getName(),
      getVerificationStatus(),
      getType(),
      getDateOfEstablishment(),
      getWebsite(),
      getAddress(),
      getCreateAt(),
    ],
    [],
  );

  return useMemo(() => {
    return {
      isLoading,
      columns,
      items: institutes,
      columnSizingOptions,
      headerProps: {
        className: 'bg-gray20',
      },
      headerCellProps: {
        className: 'h-11 capitalize',
      },
      hasNextPage,
      fetchNextPage,
      isFetchingNextPage,
      isError,
      error,
    };
  }, [
    institutes,
    columns,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
  ]);
};

const Filter = memo(() => {
  return (
    <Button icon={<Filter16Filled />} appearance="subtle">
      Filter
    </Button>
  );
});

const Institutes = () => {
  const isDeleteDrawerOpen = useAtomValue(isDeleteDrawerOpenAtom);
  const isAddDrawerOpen = useAtomValue(isAddDrawerOpenAtom);
  const isUpdateDrawerOpen = useAtomValue(isUpdateDrawerOpenAtom);
  const props = useTableProps();

  const { selectedInstitute, handleDeleteInstitute } = useDeleteInstitute();

  return (
    <PageLayout breadcrumb={breadcrumbProps}>
      <div className="w-full flex items-center justify-end mb-4">
        <div className="flex items-center gap-2">
          <Filter />
          <CustomSearchBox placeholder="Search institute" />
        </div>
      </div>

      <CustomTable {...props} />

      {isAddDrawerOpen && <AddInstituteDrawer />}

      {isUpdateDrawerOpen && <UpdateInstituteDrawer />}

      {isDeleteDrawerOpen && (
        <DeleteDrawer
          title="Delete institute"
          message={`Delete ${selectedInstitute?.name} institute.`}
          handleDelete={handleDeleteInstitute}
        />
      )}
    </PageLayout>
  );
};

export default Institutes;
