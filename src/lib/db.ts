// src/lib/db.ts
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const prismaClientSingleton = () => {
  // Gunakan absolute path agar tidak bergantung pada CWD saat runtime Next.js.
  // File dev.db berada di root project (satu level di atas folder 'src').
  const dbPath = path.resolve(process.cwd(), 'dev.db');
  const dbUrl = `file:${dbPath}`;

  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;