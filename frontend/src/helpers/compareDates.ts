const compareDates = (a: string, b: string): number => {
  const date1 = new Date(a);
  const date2 = new Date(b);

  if (date1 > date2) return 1;
  if (date1 < date2) return -1;
  return 0;
};

export default compareDates;
