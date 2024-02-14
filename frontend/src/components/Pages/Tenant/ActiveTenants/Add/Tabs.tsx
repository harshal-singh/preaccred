import {
  SelectTabData,
  SelectTabEvent,
  Tab,
  TabList,
  TabValue,
} from '@fluentui/react-components';
import { Circle24Filled, Circle24Regular } from '@fluentui/react-icons';
import { Dispatch } from 'react';

const getIcon = (value: string, selectedTabValue: unknown) => {
  if (selectedTabValue === value) {
    return <Circle24Filled />;
  }

  return <Circle24Regular />;
};

type Props = {
  selectedTabValue: TabValue;
  setSelectedTabValue: Dispatch<unknown>;
};

const Tabs = ({ selectedTabValue, setSelectedTabValue }: Props) => {
  const onTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
    setSelectedTabValue(data.value);
  };

  return (
    <TabList
      vertical
      selectedValue={selectedTabValue}
      onTabSelect={onTabSelect}
      className="w-36 border-r pr-3 mr-6"
    >
      <Tab
        id="select"
        value="select"
        icon={getIcon('select', selectedTabValue)}
        className="mt-10"
      >
        Select
      </Tab>
      <Tab
        id="packages"
        value="packages"
        icon={getIcon('packages', selectedTabValue)}
        className="mt-10"
      >
        Packages
      </Tab>
      <Tab
        id="finish"
        value="finish"
        icon={getIcon('finish', selectedTabValue)}
        className="mt-10"
      >
        Finish
      </Tab>
    </TabList>
  );
};

export default Tabs;
