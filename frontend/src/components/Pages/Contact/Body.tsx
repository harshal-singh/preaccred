import { selectedTabAtom } from 'atoms';
import { useAtomValue } from 'jotai';

import Details from './Details';
import Finish from './Finish';
import Tabs from './Tabs';

const Body = () => {
  const selectedTab = useAtomValue(selectedTabAtom);
  return (
    <>
      <Tabs />
      {selectedTab === 'details' && <Details />}
      {selectedTab === 'finish' && <Finish />}
    </>
  );
};

export default Body;
