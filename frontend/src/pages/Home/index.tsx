import { Text } from '@fluentui/react-components';

const Home = () => {
  return (
    <div className="w-full h-full flex flex-col xl:flex-row items-center justify-center gap-16">
      <Text as="h1" className="shrink-0" size={1000} weight="bold">
        Welcome to <br /> Super Admin Portal
      </Text>
    </div>
  );
};

export default Home;
