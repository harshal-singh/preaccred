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
import { memo } from 'react';
import { Link } from 'react-router-dom';

import useCurrentUserDetails from 'hooks/useCurrentUserDetails';
import { useGoogleSignOut } from 'hooks/useSignUp';

const useStyle = makeStyles({
  nav: {
    backgroundColor: tokens.colorBrandBackground2,
  },
});

const Navbar = memo(() => {
  const { currentUser } = useCurrentUserDetails();
  const { handleGoogleSignOut } = useGoogleSignOut();
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
            name={currentUser?.displayName ?? 'Loading...'}
            secondaryText={currentUser?.email?.split('@')[0] ?? 'Loading...'}
            presence={{
              status: 'available',
            }}
            avatar={{
              color: 'brand',
              image: {
                src: currentUser?.photoURL ?? '',
              },
            }}
          />
        </MenuTrigger>

        <MenuPopover>
          <MenuList>
            <MenuItem
              onClick={async () => {
                await handleGoogleSignOut();
              }}
            >
              Logout
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
});

export default Navbar;
