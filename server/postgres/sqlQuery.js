class SqlQuery {
  constructor(executor) {
    this.executor = executor;
    this.options = {};
    this.promise = null;
  }

  exec() {
    if (!this.promise) {
      this.promise = this.executor(this.options);
    }
    return this.promise;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(callback) {
    return this.exec().finally(callback);
  }

  lean() {
    return this;
  }

  populate() {
    return this;
  }

  sort(sort) {
    this.options.sort = sort;
    return this;
  }

  limit(limit) {
    this.options.limit = limit;
    return this;
  }
}

module.exports = SqlQuery;
