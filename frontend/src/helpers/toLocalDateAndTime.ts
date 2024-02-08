const toLocalDateAndTime = (date: string): string => {
  const result = new Date(date);
  return result.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export default toLocalDateAndTime;
