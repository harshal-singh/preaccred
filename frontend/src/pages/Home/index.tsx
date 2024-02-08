import { Image, Text } from '@fluentui/react-components';

import PreaccredIcon_512x512 from 'assets/Preaccred-icon-512x512.png';

const Home = () => {
  return (
    <div className="w-full h-full flex flex-col xl:flex-row items-center justify-center gap-16">
      <Image
        src={PreaccredIcon_512x512}
        alt="preaccred logo"
        width={400}
        height={400}
      />
      <Text as="h1" className="shrink-0 text-shade10" size={1000} weight="bold">
        Welcome to <br /> Admin <br /> Portal
      </Text>
    </div>
  );
};

export default Home;
