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
  selectedInstituteAtom,
  actionAtom,
} from 'atoms';
import { useAtomValue, useSetAtom } from 'jotai';
import { memo, useMemo } from 'react';

import { CustomBreadcrumbProps } from 'components/CustomBreadcrumb';
import CustomSearchBox from 'components/CustomSearchBox';
import CustomTable from 'components/CustomTable';
import DeleteDrawer from 'components/DeleteDrawer';
import PageLayout from 'components/PageLayout';
import AddInstituteDrawer from 'components/Pages/Institute/AddDrawer';
import VerificationDrawer from 'components/Pages/Institute/VerificationDrawer';

import useDeleteInstitute from 'hooks/Institute/useDelete';
import useGetVerificationPending from 'hooks/Institute/useGetVerificationPending';

import compareDates from 'helpers/compareDates';
import compareString from 'helpers/compareString';
import toLocalDateAndTime from 'helpers/toLocalDateAndTime';

const breadcrumbProps: CustomBreadcrumbProps = {
  links: [
    { name: 'home', url: '/' },
    { name: 'institutes', url: '' },
    { name: 'institutes verification', url: '/institutes/verification' },
  ],
};

const columnSizingOptions: TableColumnSizingOptions = {
  name: {
    idealWidth: 200,
  },
  isVerified: {
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

const useName = (): TableColumnDefinition<ModelTypes['Institute']> => {
  const setSelectedInstitute = useSetAtom(selectedInstituteAtom);
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
                      setSelectedInstitute(item);
                      setIsUpdateDrawerOpen(true);
                    }}
                  >
                    Approve
                  </MenuItem>
                  <MenuItem
                    icon={<ThumbDislike16Filled />}
                    onClick={() => {
                      setAction('reject');
                      setSelectedInstitute(item);
                      setIsUpdateDrawerOpen(true);
                    }}
                  >
                    Reject
                  </MenuItem>
                  <MenuItem
                    icon={<Send16Filled />}
                    onClick={() => {
                      setAction('resendEmail');
                      setSelectedInstitute(item);
                      setIsUpdateDrawerOpen(true);
                    }}
                  >
                    Resend Email
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </TableCellActions>
        </TableCellLayout>
      ),
    };
  }, [setSelectedInstitute, setAction, setIsUpdateDrawerOpen]);
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

const getVerificationStatus = (): TableColumnDefinition<
  ModelTypes['Institute']
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
  } = useGetVerificationPending();

  const name = useName();

  const columns: TableColumnDefinition<ModelTypes['Institute']>[] = useMemo(
    () => [
      name,
      getVerificationStatus(),
      getType(),
      getDateOfEstablishment(),
      getWebsite(),
      getAddress(),
      getCreateAt(),
    ],
    [name],
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

  const { selectedInstitute, handleDeleteInstitute } = useDeleteInstitute();

  return (
    <PageLayout breadcrumb={breadcrumbProps}>
      <div className="w-full flex items-center justify-between mb-4">
        <Add />
        <div className="flex items-center gap-2">
          <Filter />
          <CustomSearchBox placeholder="Search institute" />
        </div>
      </div>

      <CustomTable {...props} />

      {isAddDrawerOpen && <AddInstituteDrawer />}

      {isUpdateDrawerOpen && <VerificationDrawer />}

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

export default Verification;
