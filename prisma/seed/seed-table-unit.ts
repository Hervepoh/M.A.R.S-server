import { Prisma, PrismaClient } from '@prisma/client';

// Instantiate the Prisma Client
const prisma = new PrismaClient();


export const units =  [
    { region: 'DRC', unit: 'DPC OBALA' },
    { region: 'DRC', unit: 'DPC MFOU' },
    { region: 'DRC', unit: 'DPC BAFIA' },

    { region: 'DRD', unit: 'DVC DOUALA CENTRE' },
    { region: 'DRD', unit: 'DVC DOUALA OUEST' },
    { region: 'DRD', unit: 'DVC DOUALA SUD' },
    { region: 'DRD', unit: 'DVC DOUALA NORD' },
    { region: 'DRD', unit: 'DVC DOUALA EST' },

    { region: 'DRE', unit: 'DPC BERTOUA' },
    { region: 'DRE', unit: 'DPC EST EXT' },

    { region: 'DRNEA', unit: 'DLP EXTREME-NORD' },
    { region: 'DRNEA', unit: 'DLP ADAMAOUA' },
    { region: 'DRNEA', unit: 'DPC NORD' },

    { region: 'DRONO', unit: 'DPC BAMENDA' },
    { region: 'DRONO', unit: 'DPC BAMENDA EXT' },
    { region: 'DRONO', unit: 'DVC OUEST 1 - BAF' },
    { region: 'DRONO', unit: 'DVC OUEST 1 NOUN' },
    { region: 'DRONO', unit: 'DVC OUEST 2NHT_NKAM' },
    { region: 'DRONO', unit: 'DVC OUEST 2-MEN_BAMB' },

    { region: 'DRSANO', unit: 'DPC KRIBI' },
    { region: 'DRSANO', unit: 'DPC EDEA' },
    { region: 'DRSANO', unit: 'DPC ESEKA' },

    { region: 'DRSM', unit: 'DPC MBALMAYO' },
    { region: 'DRSM', unit: 'DPC SANGMELIMA' },
    { region: 'DRSM', unit: 'DPC EBOLOWA' },

    { region: 'DRSOM', unit: 'DPC KUMBA' },
    { region: 'DRSOM', unit: 'DPC MOUNGO' },
    { region: 'DRSOM', unit: 'DVC LIMBE' },

    { region: 'DRY', unit: 'DVC YAOUNDE CENTRE' },
    { region: 'DRY', unit: 'DVC YAOUNDE EST' },
    { region: 'DRY', unit: 'DVC YAOUNDE NORD' },
    { region: 'DRY', unit: 'DVC YAOUNDE OUEST' },
    { region: 'DRY', unit: 'DVC YAOUNDE SUD' },
   
    { region: 'SIEGE', unit: 'SIEGE' },

    { region: 'SIEGE', unit: 'SIEGE' },
];

export async function seed_units() {
 const createdUnits: { id: string; name: string; createdAt: Date; updatedAt: Date; regionId: string; }[] = []; // Array to hold created units

  const unitPromises = units.map(async (item) => {
    const unitName = item.unit.trim();
    const regionName = item.region.trim();

    // Check if the unit already exists
    let existingUnit = await prisma.unit.findUnique({
      where: { name: unitName }
    });

    // If the unit doesn't exist, create it
    if (!existingUnit) {
      // Check if the region already exists
      let region = await prisma.region.findUnique({
        where: { name: regionName }
      });

      if (!region) {
        console.error(`Region [${regionName}] does not exist, skipping unit creation for [${unitName}].`);
        return; // Skip this unit creation
      }

      try {
        const createdUnit = await prisma.unit.create({
          data: { name: unitName, regionId: region.id }
        });
        createdUnits.push(createdUnit); // Collect created units
        console.log(`Created unit: ${unitName}`);
      } catch (error) {
        // console.error(`Error creating unit [${unitName}]:`, error);
        console.error(`Error creating unit [${unitName}]:`);
        // Affichez des informations supplémentaires sur l'erreur
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          // console.error(`Error Code: ${error.code}`);
          console.error(`Error Meta: ${JSON.stringify(error.meta)}`);
        }
      }
    } else {
      console.log(`Unit [${unitName}] already exists, skipping creation.`);
    }
  });

  // Wait for all promises to resolve
  await Promise.all(unitPromises);

  // Log the created units
  console.log(`Created units: ${units.map(item => item.unit).join(', ')}`);
  createdUnits.forEach(item => {
    console.log(`Created unit [${item.name}] with id: ${item.id}`);
  });

}
