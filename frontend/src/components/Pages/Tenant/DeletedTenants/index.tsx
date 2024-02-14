import Breadcrumb from 'components/CustomBreadcrumb';

const ActiveTenants = () => {
  return (
    <>
      <Breadcrumb
        links={[
          { name: 'home', url: '/' },
          { name: 'active tenant', url: '/tenant/active' },
        ]}
      />
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Ratione sequi
      quis ipsum, mollitia assumenda consequatur exercitationem aut, illo quam
      voluptas in! Odit, quae quis doloremque earum expedita fugiat
      necessitatibus culpa.
    </>
  );
};

export default ActiveTenants;
