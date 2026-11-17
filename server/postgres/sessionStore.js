const session = require('express-session');
const { pool } = require('./index');

class PostgresSessionStore extends session.Store {
  constructor({ sessionPool = pool } = {}) {
    super();
    this.pool = sessionPool;
  }

  get(sid, callback) {
    this.pool.query(
      'SELECT sess FROM app.sessions WHERE sid = $1 AND expire > now()',
      [sid],
    ).then(({ rows }) => callback(null, rows[0] ? rows[0].sess : null)).catch(callback);
  }

  set(sid, sess, callback = () => {}) {
    const expire = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    this.pool.query(`
      INSERT INTO app.sessions (sid, sess, expire)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire
    `, [sid, JSON.stringify(sess), expire]).then(() => callback()).catch(callback);
  }

  destroy(sid, callback = () => {}) {
    this.pool.query('DELETE FROM app.sessions WHERE sid = $1', [sid])
      .then(() => callback()).catch(callback);
  }

  touch(sid, sess, callback = () => {}) {
    const expire = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    this.pool.query('UPDATE app.sessions SET expire = $2 WHERE sid = $1', [sid, expire])
      .then(() => callback()).catch(callback);
  }

  clear(callback = () => {}) {
    this.pool.query('DELETE FROM app.sessions').then(() => callback()).catch(callback);
  }

  length(callback) {
    this.pool.query('SELECT count(*)::integer AS count FROM app.sessions')
      .then(({ rows }) => callback(null, rows[0].count)).catch(callback);
  }

  clearExpired() {
    return this.pool.query('DELETE FROM app.sessions WHERE expire <= now()');
  }
}

module.exports = PostgresSessionStore;
