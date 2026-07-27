const { LruCache } = require('./lru');

describe('LruCache', () => {
  it('evicts the least recently used entry at the byte limit', () => {
    const cache = new LruCache({ maxBytes: 4, ttlMs: 1000, estimateSize: (value) => value.length });

    cache.set('one', 'aa');
    cache.set('two', 'bb');
    expect(cache.get('one')).toBe('aa');
    cache.set('three', 'cc');

    expect(cache.get('one')).toBe('aa');
    expect(cache.get('two')).toBeUndefined();
    expect(cache.get('three')).toBe('cc');
  });

  it('expires entries without requiring a timer', () => {
    const cache = new LruCache({ maxBytes: 100, ttlMs: 10, estimateSize: () => 1 });
    cache.set('room', { id: 1 }, 100);

    expect(cache.get('room', 109)).toEqual({ id: 1 });
    expect(cache.get('room', 110)).toBeUndefined();
  });

  it('invalidates related keys by prefix', () => {
    const cache = new LruCache({ maxBytes: 100, estimateSize: () => 1 });
    cache.set('room:a', 1);
    cache.set('room:b', 2);
    cache.set('user:a', 3);

    cache.invalidatePrefix('room:');

    expect(cache.size).toBe(1);
    expect(cache.get('user:a')).toBe(3);
  });
});
