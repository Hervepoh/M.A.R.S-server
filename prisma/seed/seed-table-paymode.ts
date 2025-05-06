import { PrismaClient } from '@prisma/client';

// Instantiate the Prisma Client
const prisma = new PrismaClient();

// List of payment methods
const paymentModes: string[] = [
  'CHECQUE', 
  'COMPENSATION', 
  'VIREMENT', 
  'TRAITE', 
  'VERSEMENT ESPECE', 
  'MEMO'
];

export async function seed_paymentModes() {
  const payModePromises = paymentModes.map(item =>
    prisma.paymentMode.create({
      data: { name: item },
    })
  );
  const createdPaymentModes = await Promise.all(payModePromises);
  console.log(`Created paymentModes: ${paymentModes.join(', ')}`);
  createdPaymentModes.forEach(item => {
    console.log(`Created payment Mode  [${item.name}] with id: ${item.id}`);
  });
  
}
