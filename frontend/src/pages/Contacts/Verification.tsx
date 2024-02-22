import {
  Button,
  Link,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  TableCellActions,
  TableCellLayout,
  TableColumnDefinition,
  TableColumnSizingOptions,
  Tooltip,
} from '@fluentui/react-components';
import {
  Filter16Filled,
  MoreHorizontalRegular,
  Add16Filled,
  ThumbLike16Filled,
  ThumbDislike16Filled,
  Send16Filled,
  CheckmarkStarburst16Filled,
  CircleHintHalfVertical16Regular,
} from '@fluentui/react-icons';
import { ModelTypes } from 'api/zeus';
import {
  isDeleteDrawerOpenAtom,
  isAddDrawerOpenAtom,
  isUpdateDrawerOpenAtom,
  selectedContactAtom,
  actionAtom,
} from 'atoms';
import { useAtomValue, useSetAtom } from 'jotai';
import { memo, useMemo } from 'react';

import { CustomBreadcrumbProps } from 'components/CustomBreadcrumb';
import CustomSearchBox from 'components/CustomSearchBox';
import CustomTable from 'components/CustomTable';
import DeleteDrawer from 'components/DeleteDrawer';
import PageLayout from 'components/PageLayout';
import AddContactDrawer from 'components/Pages/Contact/AddDrawer';
import VerificationDrawer from 'components/Pages/Contact/VerificationDrawer';

import useDeleteContact from 'hooks/Contact/useDelete';
import useGetVerificationPending from 'hooks/Contact/useGetVerificationPending';

import compareDates from 'helpers/compareDates';
import compareString from 'helpers/compareString';
import toLocalDateAndTime from 'helpers/toLocalDateAndTime';

const breadcrumbProps: CustomBreadcrumbProps = {
  links: [
    { name: 'home', url: '/' },
    { name: 'contacts', url: '' },
    { name: 'contacts verification', url: '/contacts/verification' },
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

const useName = (): TableColumnDefinition<ModelTypes['Contact']> => {
  const setSelectedContact = useSetAtom(selectedContactAtom);
  const setIsUpdateDrawerOpen = useSetAtom(isUpdateDrawerOpenAtom);
  const setAction = useSetAtom(actionAtom);

  return useMemo(() => {
    return {
      columnId: 'name',
      compare: (a, b) => compareString(a.name, b.name),
      renderHeaderCell: (data) => 'Name',
      renderCell: (item) => (
        <TableCellLayout truncate>
          {item.name}
          <TableCellActions>
            <Menu>
              <MenuTrigger>
                <Button
                  appearance="subtle"
                  aria-label="TenantVerificationActions"
                  icon={<MoreHorizontalRegular />}
                />
              </MenuTrigger>

              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<ThumbLike16Filled />}
                    onClick={() => {
                      setAction('approve');
                      setSelectedContact(item);
                      setIsUpdateDrawerOpen(true);
                    }}
                  >
                    Approve
                  </MenuItem>
                  <MenuItem
                    icon={<ThumbDislike16Filled />}
                    onClick={() => {
                      setAction('reject');
                      setSelectedContact(item);
                      setIsUpdateDrawerOpen(true);
                    }}
                  >
                    Reject
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </TableCellActions>
        </TableCellLayout>
      ),
    };
  }, [setSelectedContact, setAction, setIsUpdateDrawerOpen]);
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
        {item.isVerified ? (
          <span className=" flex items-center">
            <CheckmarkStarburst16Filled className="text-greenCyan10 mr-2" />
            Verified
          </span>
        ) : (
          <span className="flex items-center">
            <CircleHintHalfVertical16Regular className="text-gray120 mr-2" />
            Pending
          </span>
        )}
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
  } = useGetVerificationPending();

  const name = useName();

  const columns: TableColumnDefinition<ModelTypes['Contact']>[] = useMemo(
    () => [
      name,
      getVerificationStatus(),
      getCollegeName(),
      getPhoneNo(),
      getPrimaryEmailId(),
      getSecondaryEmailId(),
      getCreateAt(),
    ],
    [name],
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

const Add = memo(() => {
  const setIsAddDrawerOpen = useSetAtom(isAddDrawerOpenAtom);
  return (
    <Button
      icon={<Add16Filled />}
      appearance="subtle"
      onClick={() => setIsAddDrawerOpen(true)}
    >
      Add
    </Button>
  );
});

const Filter = memo(() => {
  return (
    <Button icon={<Filter16Filled />} appearance="subtle">
      Filter
    </Button>
  );
});

const Verification = () => {
  const isDeleteDrawerOpen = useAtomValue(isDeleteDrawerOpenAtom);
  const isAddDrawerOpen = useAtomValue(isAddDrawerOpenAtom);
  const isUpdateDrawerOpen = useAtomValue(isUpdateDrawerOpenAtom);
  const props = useTableProps();

  const { selectedContact, handleDeleteContact } = useDeleteContact();

  return (
    <PageLayout breadcrumb={breadcrumbProps}>
      <div className="w-full flex items-center justify-between mb-4">
        <Add />
        <div className="flex items-center gap-2">
          <Filter />
          <CustomSearchBox placeholder="Search contact" />
        </div>
      </div>

      <CustomTable {...props} />

      {isAddDrawerOpen && <AddContactDrawer />}

      {isUpdateDrawerOpen && <VerificationDrawer />}

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

export default Verification;
