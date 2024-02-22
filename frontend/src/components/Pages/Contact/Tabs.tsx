import {
  SelectTabData,
  SelectTabEvent,
  Tab,
  TabList,
} from '@fluentui/react-components';
import { Circle24Filled, Circle24Regular } from '@fluentui/react-icons';
import { selectedTabAtom } from 'atoms';
import { useAtom } from 'jotai';

const getIcon = (value: string, selectedTab: unknown) => {
  if (selectedTab === value) {
    return <Circle24Filled />;
  }

  return <Circle24Regular />;
};

const Tabs = () => {
  const [selectedTab, setSelectedTab] = useAtom(selectedTabAtom);

  const onTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value as string);
  };

  return (
    <TabList
      vertical
      selectedValue={selectedTab}
      onTabSelect={onTabSelect}
      className="w-36 border-r pr-3 mr-6"
    >
      <Tab
        id="details"
        value="details"
        icon={getIcon('details', selectedTab)}
        className="mt-10"
      >
        Details
      </Tab>
      <Tab
        id="finish"
        value="finish"
        icon={getIcon('finish', selectedTab)}
        className="mt-10"
      >
        Finish
      </Tab>
    </TabList>
  );
};

export default Tabs;
