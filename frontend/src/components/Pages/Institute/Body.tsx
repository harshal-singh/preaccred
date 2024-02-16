import { selectedTabAtom } from 'atoms';
import { useAtomValue } from 'jotai';

import Criterias from './Criterias';
import Details from './Details';
import Finish from './Finish';
import Tabs from './Tabs';

const Body = () => {
  const selectedTab = useAtomValue(selectedTabAtom);
  return (
    <>
      <Tabs />
      {selectedTab === 'details' && <Details />}
      {selectedTab === 'criterias' && <Criterias />}
      {selectedTab === 'finish' && <Finish />}
    </>
  );
};

export default Body;
