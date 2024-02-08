import { Text } from '@fluentui/react-components';
import { ReactNode, memo } from 'react';

import CustomBreadcrumb, {
  CustomBreadcrumbProps,
} from 'components/CustomBreadcrumb';

const Heading = memo(
  ({ breadcrumb }: { breadcrumb: CustomBreadcrumbProps }) => {
    const { links } = breadcrumb;
    return (
      <Text
        as="h2"
        size={700}
        weight="bold"
        className="!inline-block mb-12 capitalize"
      >
        {
          // eslint-disable-next-line unicorn/prefer-at
          links[links.length - 1].name
        }
      </Text>
    );
  },
);

const PageLayout = ({
  children,
  breadcrumb,
}: {
  children: ReactNode;
  breadcrumb: CustomBreadcrumbProps;
}) => {
  const { links } = breadcrumb;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <CustomBreadcrumb links={links} />
      <div className="flex flex-col flex-1 my-6 overflow-hidden">
        <Heading breadcrumb={breadcrumb} />
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
