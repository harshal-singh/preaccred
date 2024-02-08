import {
  IIconProps,
  INavLink,
  INavLinkGroup,
  INavStyles,
} from '@fluentui/react';
import { tokens } from '@fluentui/react-components';
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const commonIconProps: Partial<IIconProps> = {
  styles: {
    root: { color: tokens.colorNeutralForeground1, margin: '0 8px 0 12px' },
  },
};

const useSidebar = () => {
  const { pathname } = useLocation();
  const [selectedKey, setSelectedKey] = useState<string>('home');
  const [showSidebarLinkName, setShowSidebarLinkName] = useState<boolean>(true);

  const navStyles: Partial<INavStyles> = useMemo(() => {
    return {
      root: {
        padding: '0 0 0 1px',
      },
      chevronButton: {
        right: 16,
        left: 'none',
        display: showSidebarLinkName ? 'inline-flex' : 'none',
      },
    };
  }, [showSidebarLinkName]);

  const handleLinkClick = useCallback(
    (
      ev?: MouseEvent<HTMLElement, unknown> | undefined,
      item?: INavLink | undefined,
    ) => {
      if (item?.key) {
        setSelectedKey(item.key);
      }
    },
    [],
  );

  const links: INavLinkGroup[] = useMemo(
    () => [
      {
        links: [
          {
            name: 'Menu',
            url: '',
            iconProps: {
              iconName: 'Breadcrumb',
              ...commonIconProps,
            },
            ariaLabel: 'Breadcrumb',
            onClick: () => setShowSidebarLinkName(!showSidebarLinkName),
          },
          {
            name: 'Home',
            url: '/',
            iconProps: {
              iconName: 'Home',
              ...commonIconProps,
            },
            key: '/',
            ariaLabel: 'Home',
            onClick: handleLinkClick,
          },
          {
            name: 'User Management',
            url: '/users/active',
            iconProps: {
              iconName: 'ContactList',
              ...commonIconProps,
            },
            key: 'user-management',
            expandAriaLabel: 'Expand User Management',
            collapseAriaLabel: 'Collapse User Management',
            onClick: () => setSelectedKey('/users/active'),
            links: [
              {
                name: 'Active User',
                url: '/users/active',
                iconProps: {
                  iconName: 'UserFollowed',
                  ...commonIconProps,
                },
                key: '/users/active',
                ariaLabel: 'Active User',
                onClick: handleLinkClick,
              },
              {
                name: 'Deleted User',
                url: '/users/deleted',
                iconProps: {
                  iconName: 'BlockContact',
                  ...commonIconProps,
                },
                key: '/users/deleted',
                ariaLabel: 'Deleted User',
                onClick: handleLinkClick,
              },
            ],
            isExpanded:
              selectedKey === 'user-management' ||
              selectedKey === '/users/active' ||
              selectedKey === '/users/deleted',
          },
          {
            name: 'Group Management',
            url: '/groups/active',
            iconProps: {
              iconName: 'Group',
              ...commonIconProps,
            },
            key: 'group-management',
            expandAriaLabel: 'Expand Group Management',
            collapseAriaLabel: 'Collapse Group Management',
            onClick: () => setSelectedKey('/groups/active'),
            links: [
              {
                name: 'Active Group',
                url: '/groups/active',
                iconProps: {
                  iconName: 'ReminderGroup',
                  ...commonIconProps,
                },
                key: '/groups/active',
                ariaLabel: 'Active Group',
                onClick: handleLinkClick,
              },
              {
                name: 'Deleted Group',
                url: '/groups/deleted',
                iconProps: {
                  iconName: 'PeopleBlock',
                  ...commonIconProps,
                },
                key: '/groups/deleted',
                ariaLabel: 'Deleted Group',
                onClick: handleLinkClick,
              },
            ],
            isExpanded:
              selectedKey === 'group-management' ||
              selectedKey === '/groups/active' ||
              selectedKey === '/groups/deleted',
          },
          {
            name: 'Industries',
            url: '/industries',
            iconProps: {
              iconName: 'Suitcase',
              ...commonIconProps,
            },
            key: '/industries',
            ariaLabel: 'Industries',
            onClick: handleLinkClick,
          },
        ],
      },
    ],
    [handleLinkClick, selectedKey, showSidebarLinkName],
  );

  useEffect(() => {
    console.log('🚀 ~ sidebar ~ pathname:', pathname);
    setSelectedKey(pathname);
  }, [pathname]);

  console.log('Render useSidebar');

  return {
    navStyles,

    links,

    selectedKey,
    handleLinkClick,

    showSidebarLinkName,
    setShowSidebarLinkName,
  };
};

export default useSidebar;
