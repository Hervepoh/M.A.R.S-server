import { PrismaClient } from '@prisma/client';

// Instantiate the Prisma Client
const prisma = new PrismaClient();

// List of regions 
const regions: string[] = [
  'DRC',
  'DRD',
  'DRE',
  'DRNEA',
  'DRSANO',
  'DRSM',
  'DRSOM',
  'DRY',
  'DRONO',
  'SIEGE',
];

export async function seed_regions() {
  const regionPromises = regions.map(item =>
    prisma.region.create({
      data: { name: item },
    })
  );
  const createdRegions = await Promise.all(regionPromises);
  console.log(`Created regions: ${regions.join(', ')}`);
  createdRegions.forEach(item => {
    console.log(`Created region [${item.name}] with id: ${item.id}`);
  });
  
}
