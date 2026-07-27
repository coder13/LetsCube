const repository = require('./userRepository');
const SqlQuery = require('./sqlQuery');

const User = {
  isSqlRepository: true,
  findOne: (criteria) => new SqlQuery(() => repository.findOne(criteria)),
  find: (criteria, options) => new SqlQuery((queryOptions) => repository.find(
    criteria,
    { ...options, ...queryOptions },
  )),
  findOneAndUpdate: repository.findOneAndUpdate,
};

module.exports = User;
