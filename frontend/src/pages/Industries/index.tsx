import {
  Button,
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
  Edit16Filled,
  Add16Filled,
  Delete16Filled,
} from '@fluentui/react-icons';
import { ModelTypes } from 'api/zeus';
import { isDeleteDrawerOpenAtom } from 'atoms';
import { useAtomValue, useSetAtom } from 'jotai';
import { memo, useMemo } from 'react';

import { CustomBreadcrumbProps } from 'components/CustomBreadcrumb';
import CustomSearchBox from 'components/CustomSearchBox';
import CustomTable from 'components/CustomTable';
import DeleteDrawer from 'components/DeleteDrawer';
import PageLayout from 'components/PageLayout';
import AddIndustryDrawer from 'components/Pages/Industry/AddDrawer';
import UpdateIndustryDrawer from 'components/Pages/Industry/UpdateDrawer';

import {
  isAddIndustryDrawerOpenAtom,
  isUpdateIndustryDrawerOpenAtom,
  selectedIndustryAtom,
} from 'atoms/Industry';

import useActiveIndustries from 'hooks/Industry/useActiveIndustries';
import useDeleteIndustry from 'hooks/Industry/useDeleteIndustry';

import compareDates from 'helpers/compareDates';
import compareString from 'helpers/compareString';
import toLocalDateAndTime from 'helpers/toLocalDateAndTime';

const breadcrumbProps: CustomBreadcrumbProps = {
  links: [
    { name: 'home', url: '/' },
    { name: 'configuration', url: '/products' },
    { name: 'industries', url: '/industries' },
  ],
};

const columnSizingOptions: TableColumnSizingOptions = {
  name: {
    minWidth: 120,
    idealWidth: 200,
  },
  description: {
    minWidth: 120,
    idealWidth: 200,
  },
  createAt: {
    minWidth: 120,
    idealWidth: 200,
  },
};

const useName = (): TableColumnDefinition<ModelTypes['Industry']> => {
  const setSelectedIndustry = useSetAtom(selectedIndustryAtom);
  const setIsUpdateDrawerOpen = useSetAtom(isUpdateIndustryDrawerOpenAtom);
  const setIsDeleteDrawerOpen = useSetAtom(isDeleteDrawerOpenAtom);

  return useMemo(() => {
    return {
      columnId: 'name',
      compare: (a, b) => compareString(a.name, b.name),
      renderHeaderCell: (data) => 'Name',
      renderCell: (item) => (
        <Tooltip content={item.name} relationship="inaccessible" withArrow>
          <TableCellLayout truncate>
            {item.name}
            <TableCellActions>
              <Menu>
                <MenuTrigger>
                  <Button
                    appearance="subtle"
                    aria-label="more"
                    icon={<MoreHorizontalRegular />}
                  />
                </MenuTrigger>

                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      icon={<Edit16Filled />}
                      onClick={() => {
                        setSelectedIndustry(item);
                        setIsUpdateDrawerOpen(true);
                      }}
                    >
                      Update
                    </MenuItem>
                    <MenuItem
                      icon={<Delete16Filled />}
                      onClick={() => {
                        setSelectedIndustry(item);
                        setIsDeleteDrawerOpen(true);
                      }}
                    >
                      Delete
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            </TableCellActions>
          </TableCellLayout>
        </Tooltip>
      ),
    };
  }, [setIsUpdateDrawerOpen, setIsDeleteDrawerOpen, setSelectedIndustry]);
};

const getDescription = (): TableColumnDefinition<ModelTypes['Industry']> => {
  return {
    columnId: 'description',
    compare: (a, b) => compareString(a.description, b.description),
    renderHeaderCell: (data) => 'Description',
    renderCell: (item) => (
      <Tooltip content={item.description} relationship="inaccessible" withArrow>
        <TableCellLayout truncate>{item.description}</TableCellLayout>
      </Tooltip>
    ),
  };
};

const getCreateAt = (): TableColumnDefinition<ModelTypes['Industry']> => {
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
    activeIndustries,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    error,
    isError,
  } = useActiveIndustries();

  const name = useName();

  const columns: TableColumnDefinition<ModelTypes['Industry']>[] = useMemo(
    () => [name, getDescription(), getCreateAt()],
    [name],
  );

  return useMemo(() => {
    return {
      isLoading,
      columns,
      items: activeIndustries,
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
    activeIndustries,
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
  const setIsAddDrawerOpen = useSetAtom(isAddIndustryDrawerOpenAtom);
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

const Industries = () => {
  const isDeleteDrawerOpen = useAtomValue(isDeleteDrawerOpenAtom);
  const isAddDrawerOpen = useAtomValue(isAddIndustryDrawerOpenAtom);
  const isUpdateDrawerOpen = useAtomValue(isUpdateIndustryDrawerOpenAtom);
  const props = useTableProps();

  const { selectedIndustry, handleDeleteIndustry } = useDeleteIndustry();

  return (
    <PageLayout breadcrumb={breadcrumbProps}>
      <div className="w-full flex items-center justify-between mb-4">
        <Add />
        <div className="flex items-center gap-2">
          <Filter />
          <CustomSearchBox placeholder="Search industry" />
        </div>
      </div>

      <CustomTable {...props} />

      {isAddDrawerOpen && <AddIndustryDrawer />}

      {isUpdateDrawerOpen && <UpdateIndustryDrawer />}

      {isDeleteDrawerOpen && (
        <DeleteDrawer
          title="Delete industry"
          message={`Delete ${selectedIndustry?.name} industry.`}
          handleDelete={handleDeleteIndustry}
        />
      )}
    </PageLayout>
  );
};

export default Industries;
