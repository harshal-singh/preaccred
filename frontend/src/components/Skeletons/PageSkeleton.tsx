import { Skeleton, SkeletonItem } from '@fluentui/react-components';

const PageSkeleton = ({
  showAddButton = false,
}: {
  showAddButton?: boolean;
}) => {
  return (
    <div className="py-5 px-4">
      <Skeleton>
        <div className="w-36">
          <SkeletonItem shape="rectangle" size={16} />
        </div>
        <div className="py-7 w-56">
          <SkeletonItem shape="rectangle" size={40} />
        </div>
        <div
          className={`flex items-center justify-${
            showAddButton ? 'between' : 'end'
          }`}
        >
          {showAddButton && (
            <div className="py-5 w-20">
              <SkeletonItem shape="rectangle" size={28} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="py-5 w-20">
              <SkeletonItem shape="rectangle" size={28} />
            </div>
            <div className="py-5 w-56">
              <SkeletonItem shape="rectangle" size={28} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <SkeletonItem shape="rectangle" size={40} />
          <SkeletonItem shape="rectangle" size={40} />
          <SkeletonItem shape="rectangle" size={40} />
          <SkeletonItem shape="rectangle" size={40} />
          <SkeletonItem shape="rectangle" size={40} />
        </div>
      </Skeleton>
    </div>
  );
};

export default PageSkeleton;
