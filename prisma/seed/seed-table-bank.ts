import { PrismaClient } from '@prisma/client';

// Instantiate the Prisma Client
const prisma = new PrismaClient();

type Bank = {
  name: string;
  code: string;
};

// List of banks
export const banks: Bank[] = [
  { name: 'AFRILAND', code: '01' },
  { name: 'BICEC', code: '11' },
  { name: 'SCB', code: '12' },
  { name: 'SGC', code: '13' },
  { name: 'CITIBANK', code: '14' },
  { name: 'CBC', code: '15' },
  { name: 'STANDARD', code: '16' },
  { name: 'ECOBANK', code: '17' },
  { name: 'UBA', code: '18' },
  { name: 'BANQUE ATLANTIQUE', code: '19' },
  { name: 'MEMO/COMPENSATION', code: '20' },
  { name: 'BGFI', code: '21' },
  { name: 'CCA', code: '22' },
  { name: 'UBC', code: '23' }
];


export async function seed_banks() {
    const bankPromises = banks.map(item =>
        prisma.bank.create({
          data: {
            name: item.name,
            code: item.code
          },
        })
      );
      const createdBanks = await Promise.all(bankPromises);
      console.log(`Created banks: ${banks.map(bank => bank.name).join(', ')}`);
      createdBanks.forEach(item => {
        console.log(`Created bank  [${item.name}] with id: ${item.id}`);
      });


}
