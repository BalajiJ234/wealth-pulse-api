import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

function createPrismaClient() {
  const dbPath = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  // libsql expects file:<absolute-path>
  const fileUrl = dbPath.startsWith('file:')
    ? `file:${path.resolve(process.cwd(), dbPath.slice(5))}`
    : dbPath;

  const adapter = new PrismaLibSql({ url: fileUrl });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
