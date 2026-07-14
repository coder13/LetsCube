import createRequestSequence from './requestSequence';

describe('request sequence', () => {
  it('aborts and invalidates a previous request before starting another', () => {
    const requests = createRequestSequence();
    const first = requests.start();
    const second = requests.start();

    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it('invalidates an in-flight request when it is no longer needed', () => {
    const requests = createRequestSequence();
    const request = requests.start();

    requests.invalidate();

    expect(request.signal.aborted).toBe(true);
    expect(request.isCurrent()).toBe(false);
  });
});
