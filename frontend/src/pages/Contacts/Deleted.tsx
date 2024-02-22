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
import AddContactDrawer from 'components/Pages/Contact/AddDrawer';
import UpdateContactDrawer from 'components/Pages/Contact/UpdateDrawer';

import useDeleteContact from 'hooks/Contact/useDelete';
import useActiveContacts from 'hooks/Contact/useGetDeleted';

import compareDates from 'helpers/compareDates';
import compareString from 'helpers/compareString';
import toLocalDateAndTime from 'helpers/toLocalDateAndTime';

const breadcrumbProps: CustomBreadcrumbProps = {
  links: [
    { name: 'home', url: '/' },
    { name: 'contacts', url: '/contacts/verification' },
    { name: 'deleted contacts', url: '/contacts/deleted' },
  ],
};

const columnSizingOptions: TableColumnSizingOptions = {
  name: {
    idealWidth: 200,
  },
  isVerified: {
    idealWidth: 200,
  },
  collegeName: {
    idealWidth: 200,
  },
  primaryEmailId: {
    idealWidth: 200,
  },
  secondaryEmailId: {
    idealWidth: 200,
  },
  createAt: {
    idealWidth: 200,
  },
};

const getName = (): TableColumnDefinition<ModelTypes['Contact']> => {
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
  ModelTypes['Contact']
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

const getCollegeName = (): TableColumnDefinition<ModelTypes['Contact']> => {
  return {
    columnId: 'collegeName',
    compare: (a, b) => compareString(a.collegeName, b.collegeName),
    renderHeaderCell: (data) => 'College Name',
    renderCell: (item) => (
      <Tooltip content={item.collegeName} relationship="inaccessible" withArrow>
        <TableCellLayout truncate>{item.collegeName}</TableCellLayout>
      </Tooltip>
    ),
  };
};

const getPhoneNo = (): TableColumnDefinition<ModelTypes['Contact']> => {
  return {
    columnId: 'phoneNo',
    compare: (a, b) => compareString(a.phoneNo, b.phoneNo),
    renderHeaderCell: (data) => 'Phone No',
    renderCell: (item) => (
      <Tooltip content={item.phoneNo} relationship="inaccessible" withArrow>
        <TableCellLayout truncate>
          <Link href={`tel:${item.phoneNo}`}>{item.phoneNo}</Link>
        </TableCellLayout>
      </Tooltip>
    ),
  };
};

const getPrimaryEmailId = (): TableColumnDefinition<ModelTypes['Contact']> => {
  return {
    columnId: 'primaryEmailId',
    compare: (a, b) => compareString(a.primaryEmailId, b.primaryEmailId),
    renderHeaderCell: (data) => 'Primary EmailId',
    renderCell: (item) => (
      <Tooltip
        content={item.primaryEmailId}
        relationship="inaccessible"
        withArrow
      >
        <TableCellLayout truncate>
          <Link href={`mailto:${item.primaryEmailId}`}>
            {item.primaryEmailId}
          </Link>
        </TableCellLayout>
      </Tooltip>
    ),
  };
};

const getSecondaryEmailId = (): TableColumnDefinition<
  ModelTypes['Contact']
> => {
  return {
    columnId: 'secondaryEmailId',
    compare: (a, b) => compareString(a.secondaryEmailId, b.secondaryEmailId),
    renderHeaderCell: (data) => 'Secondary EmailId',
    renderCell: (item) => (
      <Tooltip
        content={item.secondaryEmailId}
        relationship="inaccessible"
        withArrow
      >
        <TableCellLayout truncate>
          <Link href={`mailto:${item.secondaryEmailId}`}>
            {item.secondaryEmailId}
          </Link>
        </TableCellLayout>
      </Tooltip>
    ),
  };
};

const getCreateAt = (): TableColumnDefinition<ModelTypes['Contact']> => {
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
    contacts,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
    isError,
  } = useActiveContacts();

  const columns: TableColumnDefinition<ModelTypes['Contact']>[] = useMemo(
    () => [
      getName(),
      getVerificationStatus(),
      getCollegeName(),
      getPhoneNo(),
      getPrimaryEmailId(),
      getSecondaryEmailId(),
      getCreateAt(),
    ],
    [],
  );

  return useMemo(() => {
    return {
      isLoading,
      columns,
      items: contacts,
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
    contacts,
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

const Contacts = () => {
  const isDeleteDrawerOpen = useAtomValue(isDeleteDrawerOpenAtom);
  const isAddDrawerOpen = useAtomValue(isAddDrawerOpenAtom);
  const isUpdateDrawerOpen = useAtomValue(isUpdateDrawerOpenAtom);
  const props = useTableProps();

  const { selectedContact, handleDeleteContact } = useDeleteContact();

  return (
    <PageLayout breadcrumb={breadcrumbProps}>
      <div className="w-full flex items-center justify-end mb-4">
        <div className="flex items-center gap-2">
          <Filter />
          <CustomSearchBox placeholder="Search contact" />
        </div>
      </div>

      <CustomTable {...props} />

      {isAddDrawerOpen && <AddContactDrawer />}

      {isUpdateDrawerOpen && <UpdateContactDrawer />}

      {isDeleteDrawerOpen && (
        <DeleteDrawer
          title="Delete contact"
          message={`Delete ${selectedContact?.name} contact.`}
          handleDelete={handleDeleteContact}
        />
      )}
    </PageLayout>
  );
};

export default Contacts;
