import { IComponentAsProps, Nav, INavButtonProps, Icon } from '@fluentui/react';
import { Text, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import { memo } from 'react';
import { Link } from 'react-router-dom';

import useSidebar from 'hooks/components/useSidebar';

const useStyle = makeStyles({
  nav: {
    backgroundColor: tokens.colorNeutralBackground5,
  },
  navItem: {
    color: tokens.colorNeutralForeground1,
    ':hover': {
      color: 'inherit',
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
    '&.active': {
      borderLeftColor: tokens.colorBrandBackgroundStatic,
      backgroundColor: tokens.colorSubtleBackgroundPressed,
    },
  },
});

const CustomNavLinks = (
  props: IComponentAsProps<INavButtonProps>,
  selectedKey: string,
  showSidebarLinkName: boolean,
) => {
  const classes = useStyle();

  if (props.link) {
    return (
      <Tooltip
        content={props.link.name}
        relationship="inaccessible"
        positioning="after"
        withArrow
      >
        <div
          role="button"
          tabIndex={0}
          className={`${classes.navItem} ${
            props.link.key === selectedKey ? 'active' : ''
          } flex place-items-center justify-start h-11 border-l-4 border-l-transparent cursor-pointer`}
          onClick={(ev) => props.link?.onClick?.call(this, ev, props.link)}
          onKeyDown={(ev: { key: string }) =>
            ev.key === 'Enter' &&
            props.link?.onClick?.call(this, undefined, props.link)
          }
        >
          {props.link.name === 'Menu' ? (
            <Icon
              iconName={props.link.iconProps?.iconName}
              styles={props.link.iconProps?.styles}
              className="text-base px-3 m-0 mx-1"
            />
          ) : (
            <Link
              to={props.link.url}
              className="flex flex-grow flex-nowrap items-center h-full"
            >
              <Icon
                iconName={props.link.iconProps?.iconName}
                styles={props.link.iconProps?.styles}
                className="text-base px-3 m-0 mx-1"
              />
              {showSidebarLinkName && <Text>{props.link.name}</Text>}
            </Link>
          )}
        </div>
      </Tooltip>
    );
  }

  return null;
};

const Sidebar = () => {
  const classes = useStyle();

  const {
    navStyles,

    links,

    selectedKey,

    showSidebarLinkName,
  } = useSidebar();

  console.log('Render Sidebar');

  return (
    <>
      <div
        className={`${
          showSidebarLinkName ? 'w-64' : 'w-14'
        } transition-all shrink-0 grow-0`}
      />
      <Nav
        styles={navStyles}
        className={`${classes.nav} ${
          showSidebarLinkName ? 'w-64' : 'w-14'
        } fixed inset-0 z-40 min-h-full pt-14 border-r box-border overflow-auto bg-white transition-all`}
        groups={links}
        selectedKey={selectedKey}
        ariaLabel="Preaccred Sidebar"
        linkAs={(props: IComponentAsProps<INavButtonProps>) =>
          CustomNavLinks(props, selectedKey, showSidebarLinkName)
        }
      />
    </>
  );
};

export default memo(Sidebar);
