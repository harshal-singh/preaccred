import {
  Image,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Persona,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { isLoggedInAtom } from 'atoms';
import { useAtom } from 'jotai';
import { memo } from 'react';
import { Link } from 'react-router-dom';

const useStyle = makeStyles({
  nav: {
    backgroundColor: tokens.colorBrandBackground2,
  },
});

const Navbar = () => {
  const [, setIsLoggedIn] = useAtom(isLoggedInAtom);
  const classes = useStyle();

  console.log('Render Navbar');

  return (
    <div
      className={`${classes.nav} fixed top-0 inset-x-0 z-50 flex items-center justify-between h-14 py-3 px-4 shadow-md`}
    >
      <Link to="/">
        <Image
          src="/images/preaccred-logo-180px.png"
          alt="preaccred logo"
          width={180}
        />
      </Link>

      <Menu positioning="below-end">
        <MenuTrigger disableButtonEnhancement>
          <Persona
            className="cursor-pointer"
            name="Harshal Singh"
            secondaryText="Tenant admin"
            presence={{
              status: 'available',
            }}
            avatar={{
              color: 'brand',
              // image: {
              //   src: 'https://res-1.cdn.office.net/files/fabric-cdn-prod_20230815.002/office-ui-fabric-react-assets/persona-male.png',
              // },
            }}
          />
        </MenuTrigger>

        <MenuPopover>
          <MenuList>
            <MenuItem
              onClick={() => {
                setIsLoggedIn(false);
              }}
            >
              Logout
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
};

export default memo(Navbar);
