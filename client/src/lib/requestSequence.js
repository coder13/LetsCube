const createRequestSequence = () => {
  let controller = null;
  let sequence = 0;

  const invalidate = () => {
    sequence += 1;
    if (controller) controller.abort();
    controller = null;
  };

  return {
    invalidate,
    start() {
      invalidate();
      const requestId = sequence;
      controller = new AbortController();
      return {
        isCurrent: () => requestId === sequence,
        signal: controller.signal,
      };
    },
  };
};

export default createRequestSequence;
