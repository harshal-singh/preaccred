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
          },
          {
            name: 'Institute Management',
            url: '/institutes/verification',
            iconProps: {
              iconName: 'CityNext',
              ...commonIconProps,
            },
            key: 'institute-management',
            expandAriaLabel: 'Expand Institute Management',
            collapseAriaLabel: 'Collapse Institute Management',
            links: [
              {
                name: 'Verification',
                url: '/institutes/verification',
                iconProps: {
                  iconName: 'HomeGroup',
                  ...commonIconProps,
                },
                key: '/institutes/verification',
                ariaLabel: 'Verification',
              },
              {
                name: 'Active Institute',
                url: '/institutes/active',
                iconProps: {
                  iconName: 'ReceiptCheck',
                  ...commonIconProps,
                },
                key: '/institutes/active',
                ariaLabel: 'Active Institute',
              },
              {
                name: 'Deleted Institute',
                url: '/institutes/deleted',
                iconProps: {
                  iconName: 'ReceiptUndelivered',
                  ...commonIconProps,
                },
                key: '/institutes/deleted',
                ariaLabel: 'Deleted Institute',
              },
            ],
            isExpanded:
              selectedKey === 'institute-management' ||
              selectedKey === '/institutes/verification' ||
              selectedKey === '/institutes/active' ||
              selectedKey === '/institutes/deleted',
          },
          {
            name: 'Contact Management',
            url: '/contacts/verification',
            iconProps: {
              iconName: 'ContactList',
              ...commonIconProps,
            },
            key: 'contact-management',
            expandAriaLabel: 'Expand Contact Management',
            collapseAriaLabel: 'Collapse Contact Management',
            links: [
              {
                name: 'Verification',
                url: '/contacts/verification',
                iconProps: {
                  iconName: 'HomeGroup',
                  ...commonIconProps,
                },
                key: '/contacts/verification',
                ariaLabel: 'Verification',
              },
              {
                name: 'Active Contact',
                url: '/contacts/active',
                iconProps: {
                  iconName: 'ReceiptCheck',
                  ...commonIconProps,
                },
                key: '/contacts/active',
                ariaLabel: 'Active Contact',
              },
              {
                name: 'Deleted Contact',
                url: '/contacts/deleted',
                iconProps: {
                  iconName: 'ReceiptUndelivered',
                  ...commonIconProps,
                },
                key: '/contacts/deleted',
                ariaLabel: 'Deleted Contact',
              },
            ],
            isExpanded:
              selectedKey === 'contact-management' ||
              selectedKey === '/contacts/verification' ||
              selectedKey === '/contacts/active' ||
              selectedKey === '/contacts/deleted',
          },
        ],
      },
    ],
    [selectedKey, showSidebarLinkName],
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
