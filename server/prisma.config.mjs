import { defineConfig } from 'prisma/config';

const databaseUrl = () => {
  if (process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL) {
    return process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  }

  const user = encodeURIComponent(process.env.PGUSER || 'letscube');
  const password = encodeURIComponent(process.env.PGPASSWORD
    || process.env.POSTGRES_PASSWORD
    || 'letscube');
  const host = process.env.PGHOST || '127.0.0.1';
  const port = process.env.PGPORT || '5432';
  const database = encodeURIComponent(process.env.PGDATABASE || 'letscube');
  const ssl = process.env.PGSSL === 'true' ? '?sslmode=require' : '';

  return `postgresql://${user}:${password}@${host}:${port}/${database}${ssl}`;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl(),
  },
});
