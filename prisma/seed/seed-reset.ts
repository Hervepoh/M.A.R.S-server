import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function reset() {
// Clear database tables
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;
  await prisma.audit.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.region.deleteMany({});
  await prisma.segment.deleteMany({});
  await prisma.reference.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.transactionDetail.deleteMany({});
  await prisma.transactionTempUser.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.paymentMode.deleteMany({});
  await prisma.status.deleteMany({});
  await prisma.bankAgency.deleteMany({});
  await prisma.bank.deleteMany({});
  await prisma.customerReference.deleteMany({});
  await prisma.$executeRaw`TRUNCATE TABLE status`;
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
}