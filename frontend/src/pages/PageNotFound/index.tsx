import { Text } from '@fluentui/react-components';

const PageNotFound = () => {
  return (
    <div className="px-4 pt-9">
      <Text as="h4" size={500} weight="semibold" block>
        404 - Page Not Found
      </Text>
      <Text className="mt-2" block>
        Oops! It looks like the page you are trying to reach does not exist or
        may have been moved.
      </Text>
    </div>
  );
};

export default PageNotFound;
