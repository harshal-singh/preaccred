import { Text } from '@fluentui/react-components';
import { memo } from 'react';
import { Link } from 'react-router-dom';

export type LinkProp = { name: string; url: string };

export type CustomBreadcrumbProps = {
  links: LinkProp[];
  className?: string;
};

const CustomBreadcrumb = (props: CustomBreadcrumbProps) => {
  return (
    <div className={props.className}>
      {props.links.map((link, index, items) => {
        return (
          <span key={link.url}>
            {index !== 0 && (
              <Text size={400} className="mx-2 text-gray90">
                /
              </Text>
            )}
            <Link to={link.url}>
              <Text
                as="h6"
                className={`${
                  items.length === index + 1 ? '' : 'text-gray90'
                } capitalize`}
              >
                {link.name}
              </Text>
            </Link>
          </span>
        );
      })}
    </div>
  );
};

export default memo(CustomBreadcrumb);
