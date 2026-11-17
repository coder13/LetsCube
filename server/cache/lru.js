class LruCache {
  constructor({ maxBytes = 128 * 1024 * 1024, ttlMs = 60 * 1000, estimateSize = defaultSize } = {}) {
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
      throw new Error('LRU maxBytes must be positive');
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('LRU ttlMs must be positive');
    }

    this.maxBytes = maxBytes;
    this.ttlMs = ttlMs;
    this.estimateSize = estimateSize;
    this.entries = new Map();
    this.bytes = 0;
  }

  get size() {
    return this.entries.size;
  }

  get usedBytes() {
    return this.bytes;
  }

  get(key, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= now) {
      this.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value, now = Date.now()) {
    const bytes = Math.max(1, this.estimateSize(value));
    this.delete(key);

    if (bytes > this.maxBytes) {
      return false;
    }

    this.entries.set(key, {
      value,
      bytes,
      expiresAt: now + this.ttlMs,
    });
    this.bytes += bytes;
    this.evict(now);
    return true;
  }

  delete(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }
    this.entries.delete(key);
    this.bytes -= entry.bytes;
    return true;
  }

  clear() {
    this.entries.clear();
    this.bytes = 0;
  }

  invalidatePrefix(prefix) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.delete(key);
      }
    }
  }

  evict(now = Date.now()) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now || this.bytes > this.maxBytes) {
        this.delete(key);
      }
      if (this.bytes <= this.maxBytes) {
        break;
      }
    }
  }
}

const defaultSize = (value) => {
  try {
    return Buffer.byteLength(JSON.stringify(value));
  } catch {
    return 1;
  }
};

module.exports = { LruCache, defaultSize };
