import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { serviceType } from '../../src/constants/enum';
import { SALT_ROUNDS } from '../../src/secrets';
import { redis } from '../../src/core/utils/redis';
import { importCsvToDatabase } from './seed-referentiel';
import { userList } from './seed-user';
import { units } from './seed-table-unit';

const prisma = new PrismaClient();

// List of payment methods
const paymentModes = ['CHECQUE', 'COMPENSATION', 'VIREMENT', 'TRAITE', 'VERSEMENT ESPECE', 'MEMO'];

// List of banks
const banks = [
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

// List of regions 
const regions = [
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



// List of segments 
const segments = [
  'ADMINISTRATION',
  'AGROALIMENTAIRE, EAU, ENERGIE ET AUTRES SERVICES',
  'MARCHE DE MASSE',
  'SOCIETES DES ACIERIES, CIMENTERIE, TEXTILE, METALLURGIE',
  'TELECOMS, BANQUES, ASSURANCES ET TRANSPORT'
];

// List of status
const status = [
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

// List of roles
const roles = ['ADMIN', 'USER', 'VALIDATOR', 'ASSIGNATOR', 'COMMERCIAL', 'MANAGER'];

// Begin declarate List of permissions
const services = Object.values(serviceType);
const permissions = [
  'CREATE', 'READ', 'WRITE', 'UPDATE', 'DELETE', 'BULKCREATE', 'BULKDELETE', 'SEARCH'
];
const customPermissions = [
  "ICN-NEXTCODE", 'ICN-NEXTDEMATERIALIZATION', "ICN-GROUPES", "ICN-DOCUMENTS",
  "USER-READNOTIFICATION", "USER-ROLE", "USER-ADDROLE", "USER-REMOVEROLE", "USER-NOTIFICATION",
  "TRANSACTION-PUBLISH", "TRANSACTION-VALIDATE", "TRANSACTION-ASSIGN", "TRANSACTION-COMMERCIAL",
  "SUMMARY-README"
];
// End declarate List of permissions


// Begin Listing Specific permissions to be assigned by pofil
// for COMMERCIAL
const specificPermissionForCOMMERCIAL = [
  "TRANSACTION-READ", "TRANSACTION-COMMERCIAL",
  "TRANSACTIONDETAIL-READ", "TRANSACTIONDETAIL-WRITE", "TRANSACTIONDETAIL-BULKCREATE", "TRANSACTIONDETAIL-BULKDELETE",
  "SUMMARY-README",
  "BANK-READ",
  "REGION-READ",
  "UNIT-READ",
  "SEGMENT-READ",
  "PAYMENTMODE-READ",
  "UNPAID-SEARCH",
  "ICN-READ",
  "ROLE-READ",
  "USER-READNOTIFICATION"
];
// for Assignator
const specificPermissionForAssignator = [
  "SUMMARY-READ",
  "TRANSACTION-READ", "TRANSACTION-ASSIGN",
  "REGION-READ",
  "UNIT-READ",
  "SEGMENT-READ",
  "USER-SEARCH"
];
// for Validation
const specificPermissionForValidation = [
  "SUMMARY-READ",
  "TRANSACTION-READ",
  "TRANSACTION-VALIDATE"
];
// for Initiator
const specificPermissionForUSER = [
  "TRANSACTION-READ", "TRANSACTION-WRITE", "TRANSACTION-PUBLISH", "TRANSACTION-BULKCREATE",
  "SUMMARY-README",
  "BANK-READ",
  "PAYMENTMODE-READ",
  "SEGMENT-READ",
  "UNPAID-SEARCH",
  "ICN-READ",
  "ROLE-READ",
  "USER-READNOTIFICATION"
];
// End Listing Specific permissions to be assigned by pofil

const servicePermissions = services.flatMap(service =>
  permissions.map(permission => `${service}-${permission}`)
);

// Users data
const users: Prisma.UserCreateInput[] = userList;

async function main() {
  console.log(`##########################`);
  console.log(`##      Start seeding   ##`);
  console.log(`##########################`);

  // Clean redis cache
  redis.flushdb();

  console.log(`Cache cleared.`);

  // Clear database tables

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
  await prisma.transaction.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.paymentMode.deleteMany({});
  await prisma.status.deleteMany({});
  await prisma.bank.deleteMany({});
  await prisma.customerReference.deleteMany({});
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;
  await prisma.$executeRaw`TRUNCATE TABLE status`;
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;

  console.log(`Tables cleared.`);

  // Insert Banks 
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
  console.log(`  `);
  /////////////////////////////////////

  // Insert Payment Modes
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
  console.log(`  `);
  /////////////////////////////////////

  // Insert Segments
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
  console.log(`  `);
  /////////////////////////////////////

  // Insert Regions
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
  console.log(`  `);
  /////////////////////////////////////

  // Insert Units
  const createdUnits: { id: string; name: string; createdAt: Date; updatedAt: Date; regionId: string; }[] = []; // Array to hold created units

  const unitPromises = units.map(async (item:{unit:string, region:string}) => {
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
  console.log(`Created units: ${units.map((item:{unit:string})=> item.unit).join(', ')}`);
  createdUnits.forEach(item => {
    console.log(`Created unit [${item.name}] with id: ${item.id}`);
  });
  console.log(`  `);
  /////////////////////////////////////

  // Insert Permissions
  const permissionPromises = servicePermissions.map(permission =>
    prisma.permission.create({
      data: { name: permission! },
    })
  );
  const createdPermissions = await Promise.all(permissionPromises);
  console.log(`Created permissions: ${servicePermissions.join(', ')}`);
  createdPermissions.forEach(item => {
    console.log(`Created permission [${item.name}] with id: ${item.id}`);
  });

  const customPermissionsPromises = customPermissions.map(item =>
    prisma.permission.create({
      data: { name: item },
    })
  );
  const createdCustomPermissions = await Promise.all(customPermissionsPromises);
  createdCustomPermissions.forEach(item => {
    console.log(`Created permission [${item.name}] with id: ${item.id}`);
  });
  console.log(`  `);
  /////////////////////////////////////

  // insert Roles
  const rolePromises = roles.map(role =>
    prisma.role.create({
      data: { name: role },
    })
  );
  const createdRoles = await Promise.all(rolePromises);
  console.log(`Created roles: ${roles.join(', ')}`);
  createdRoles.forEach(item => {
    console.log(`Created role [${item.name}] with id: ${item.id}`);
  });
  console.log(`  `);
  /////////////////////////////////////

  // Insert users
  const userPromises = users.map(async u =>
    prisma.user.create({
      data: {
        ...u,
        password: await bcrypt.hash(u.password, parseInt(SALT_ROUNDS || '10')!)
      },
    })
  );
  const createdUsers = await Promise.all(userPromises);
  createdUsers.forEach(user => {
    console.log(`Created user with id: ${user.id}`);
  });
  console.log(`  `);
  /////////////////////////////////////

  // (Optional) Associate roles with users
  // For ADMIN
  const USER_ADMIN = await prisma.user.findFirst({
    where: { name: "admin" }
  })
  const ROLE_ADMIN = await prisma.role.findFirst({
    where: { name: "ADMIN" }
  })
  if (USER_ADMIN && ROLE_ADMIN) {
    await prisma.userRole.create({
      data: {
        userId: USER_ADMIN.id,
        roleId: ROLE_ADMIN.id,
      }
    });
    console.log(`ROLE ${ROLE_ADMIN.name}  assign to the user ${USER_ADMIN.name}`);
  }

  //FOR VALIDATOR
  const USER_VALIDATOR = await prisma.user.findFirst({
    where: { name: "validateur" }
  })
  const ROLE_VALIDATOR = await prisma.role.findFirst({
    where: { name: "VALIDATOR" }
  })
  if (USER_VALIDATOR && ROLE_VALIDATOR) {
    await prisma.userRole.create({
      data: {
        userId: USER_VALIDATOR.id,
        roleId: ROLE_VALIDATOR.id,
      }
    });
    console.log(`ROLE ${ROLE_VALIDATOR.name}  assign to the user ${USER_VALIDATOR.name}`);
  }

  //FOR COMMERCIAL
  const USER_COMMERCIAL = await prisma.user.findFirst({
    where: { name: "commercial" }
  })
  const ROLE_COMMERCIAL = await prisma.role.findFirst({
    where: { name: "COMMERCIAL" }
  })
  if (USER_COMMERCIAL && ROLE_COMMERCIAL) {
    await prisma.userRole.create({
      data: {
        userId: USER_COMMERCIAL.id,
        roleId: ROLE_COMMERCIAL.id,
      }
    });
    console.log(`ROLE ${ROLE_COMMERCIAL.name}  assign to the user ${USER_COMMERCIAL.name}`);
  }

  //FOR ASSIGNATOR
  const USER_ASSIGNATOR = await prisma.user.findFirst({
    where: { name: "assignateur" }
  })
  const ROLE_ASSIGNATOR = await prisma.role.findFirst({
    where: { name: "ASSIGNATOR" }
  })
  if (USER_ASSIGNATOR && ROLE_ASSIGNATOR) {
    await prisma.userRole.create({
      data: {
        userId: USER_ASSIGNATOR.id,
        roleId: ROLE_ASSIGNATOR.id,
      }
    });
    console.log(`ROLE ${ROLE_ASSIGNATOR.name}  assign to the user ${USER_ASSIGNATOR.name}`);
  }

  //FOR ALL USER  IN TEST
  // for (const user of createdUsers.slice(0, 4)) {
  //   await prisma.userRole.create({
  //     data: {
  //       userId: user.id,
  //       roleId: createdRoles[1].id,
  //     }
  //   });
  // }

  // (Optionnel) Associer les permissions aux rôles
  for (const role of createdRoles.slice(0, 1)) {
    for (const permission of createdPermissions) {
      const db = await prisma.permission.findUnique({
        where: { name: permission.name }
      })
      if (db) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: db.id,
          }
        });
      }

    }
    for (const permission of createdCustomPermissions) {
      const db = await prisma.permission.findUnique({
        where: { name: permission.name }
      })
      if (db) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: db.id,
          }
        });
      }

    }
  }

  // role spécial pour les simples utilisateurs
  const ROLE_USER = await prisma.role.findFirst({
    where: { name: "USER" }
  })
  if (ROLE_USER) {
    for (const name of specificPermissionForUSER) {
      const db = await prisma.permission.findUnique({
        where: { name: name }
      })

      if (db) {
        await prisma.rolePermission.create({
          data: {
            roleId: ROLE_USER.id,
            permissionId: db.id,
          }
        });
      }

    }
  }


  // role spécial pour les validations
  if (ROLE_VALIDATOR) {
    for (const name of specificPermissionForValidation) {
      const db = await prisma.permission.findUnique({
        where: { name: name }
      })

      if (db) {
        await prisma.rolePermission.create({
          data: {
            roleId: ROLE_VALIDATOR.id,
            permissionId: db.id,
          }
        });
      }

    }
  }

  // role spécial pour les assignateurs
  if (ROLE_ASSIGNATOR) {
    for (const name of specificPermissionForAssignator) {
      const db = await prisma.permission.findUnique({
        where: { name: name }
      })

      if (db) {
        await prisma.rolePermission.create({
          data: {
            roleId: ROLE_ASSIGNATOR.id,
            permissionId: db.id,
          }
        });
      }

    }
  }


  // role spécial pour les commerciaux (KAM)
  if (ROLE_COMMERCIAL) {
    for (const name of specificPermissionForCOMMERCIAL) {
      const db = await prisma.permission.findUnique({
        where: { name: name }
      })

      if (db) {
        await prisma.rolePermission.create({
          data: {
            roleId: ROLE_COMMERCIAL.id,
            permissionId: db.id,
          }
        });
      }

    }
  }


  // insert Status
  const createdStatus = [];

  for (const item of status) {
    const created = await prisma.status.create({
      data: { name: item },
    });
    createdStatus.push(created);
  }
  console.log(`Created status: ${createdStatus.map(s => s.name).join(', ')}`);
  console.log(`    `)

  // Commercial Organisation of users
  // FOR commercial 
  const USER_UNIT = await prisma.unit.findFirst({
    where: { name: "DVC DOUALA NORD" }
  })

  if (USER_COMMERCIAL && USER_UNIT) {
    await prisma.user.update({
      where: { id: USER_COMMERCIAL.id },
      data: {
        unitId: USER_UNIT.id,
      }
    });
    console.log(`USER_COMMERCIAL ${USER_COMMERCIAL.name}  is in unit ${USER_UNIT.name}`);
  }


  // Customer_reference import 
  const filePath = '/home/hervengando/clients.csv';
  await importCsvToDatabase(filePath);

  console.log(`##########################`);
  console.log(`##   Seeding finished.  ##`);
  console.log(`##########################`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(1);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
