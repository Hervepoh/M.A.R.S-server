import { PrismaClient } from '@prisma/client';

// Instantiate the Prisma Client
const prisma = new PrismaClient();

// List of status 
const status: string[] = [
  'deleted',
  "draft",
  "initiated",
  "validated",
  "rejected",
  "pending_commercial_input",
  "pending_finance_validation",
  "processing",
  "treated"
];


export async function seed_status() {
  // insert Status
  const createdStatus = [];

  for (const item of status) {
    const created = await prisma.status.create({
      data: { name: item },
    });
    createdStatus.push(created);
  }
  console.log(`Created status: ${createdStatus.map(s => s.name).join(', ')}`);
  createdStatus.forEach(item => {
    console.log(`Created status [${item.name}] with id: ${item.id}`);
  });

}
