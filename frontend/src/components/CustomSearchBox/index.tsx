import { SearchBox, ISearchBoxProps, ISearchBoxStyles } from '@fluentui/react';
import { memo } from 'react';

const searchBoxStyles: Partial<ISearchBoxStyles> = { root: { width: 264 } };

const CustomSearchBox = (props: ISearchBoxProps) => {
  return <SearchBox {...props} underlined styles={searchBoxStyles} />;
};

export default memo(CustomSearchBox);
