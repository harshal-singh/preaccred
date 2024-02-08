const getOrganizationType = (organizationId: string): string => {
  const type = organizationId[3];
  if (type === 'E') {
    return 'Employee';
  }
  if (type === 'P') {
    return 'Partner';
  }
  if (type === 'D') {
    return 'Distributor';
  }
  return '';
};

export default getOrganizationType;
