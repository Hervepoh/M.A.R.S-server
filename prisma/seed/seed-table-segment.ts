import { PrismaClient } from '@prisma/client';

// Instantiate the Prisma Client
const prisma = new PrismaClient();

// List of segments 
const segments: string[] = [
  'ADMINISTRATION',
  'AGROALIMENTAIRE, EAU, ENERGIE ET AUTRES SERVICES',
  'MARCHE DE MASSE',
  'SOCIETES DES ACIERIES, CIMENTERIE, TEXTILE, METALLURGIE',
  'TELECOMS, BANQUES, ASSURANCES ET TRANSPORT'
];

export async function seed_segments() {
  const segmentPromises = segments.map(item =>
    prisma.segment.create({
      data: { name: item },
    })
  );
  const createdSegments = await Promise.all(segmentPromises);
  console.log(`Created segments: ${segments.join(', ')}`);
  createdSegments.forEach(item => {
    console.log(`Created segment [${item.name}] with id: ${item.id}`);
  });
  
}
