import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

import { SALT_ROUNDS } from '../../src/secrets';
import { redis } from '../../src/core/utils/redis';

import { reset } from './seed-reset';
import { seed_status } from './seed-table-status';
import { seed_regions } from './seed-table-region';
import { seed_units } from './seed-table-unit';
import { seed_segments } from './seed-table-segment';
import { seed_banks } from './seed-table-bank';
import { seed_bankAgencies } from './seed-table-bankagency';
import { seed_paymentModes } from './seed-table-paymode';
import { importCsvToDatabase } from './seed-referentiel';
import { seed_roles } from './seed-table-role';
import { userList } from './seed-user-test';
import { seed_permissions, specificPermissionForAssignator, specificPermissionForCOMMERCIAL, specificPermissionForManager, specificPermissionForUSER, specificPermissionForValidation, specificPermissionForVERIFIER } from './seed-table-permissions';


const prisma = new PrismaClient();



// Users data
const users: Prisma.UserCreateInput[] = userList;

async function main() {

  console.log(`##########################`);
  console.log(`##      Start seeding   ##`);
  console.log(`##########################`);

  // Clean redis cache
  redis.flushdb();

  console.log(`Cache cleared.`);
  
  /////////////////////////////////////

  // Clear database tables
  await reset();

  console.log(`Tables cleared.`);

  /////////////////////////////////////

  // Insert Status 
  await seed_status();
  console.log(`  `);

  /////////////////////////////////////

  // Insert Banks 
  await seed_banks();
  console.log(`  `);
  
  /////////////////////////////////////

  // Insert Banks Agencies(Branch) 
  await seed_bankAgencies();
  console.log(`  `);
  
  /////////////////////////////////////

  // Insert Payment Modes
  await seed_paymentModes();
  console.log(`  `);

  /////////////////////////////////////

  // Insert Segments
  await seed_segments()
  console.log(`  `);

  /////////////////////////////////////

  // Insert Regions
  await seed_regions()
  console.log(`  `);

  /////////////////////////////////////

  // Insert Units
  await seed_units()
  console.log(`  `);

  /////////////////////////////////////

  // Insert Roles
  const createdRoles = await seed_roles()
  console.log(`  `);

  /////////////////////////////////////

   // Insert Permissions
 //const {createdPermissions,createdCustomPermissions} =  await seed_permissions();
 const createdPermissions =  await seed_permissions();
  console.log(`  `);

  /////////////////////////////////////


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

  //FOR VERIFIER
  const USER_VERIFIER = await prisma.user.findFirst({
    where: { name: "verifier" }
  })
  const ROLE_VERIFIER = await prisma.role.findFirst({
    where: { name: "VERIFIER" }
  })
  if (USER_VERIFIER && ROLE_VERIFIER) {
    await prisma.userRole.create({
      data: {
        userId: USER_VERIFIER.id,
        roleId: ROLE_VERIFIER.id,
      }
    });
    console.log(`ROLE ${ROLE_VERIFIER.name}  assign to the user ${USER_VERIFIER.name}`);
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
  for (const user of createdUsers.slice(0, 4)) {
    if (user.name != 'admin') {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: createdRoles[1].id,
        }
      });
    }
  }

 
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
    // for (const permission of createdCustomPermissions) {
    //   const db = await prisma.permission.findUnique({
    //     where: { name: permission.name }
    //   })
    //   if (db) {
    //     await prisma.rolePermission.create({
    //       data: {
    //         roleId: role.id,
    //         permissionId: db.id,
    //       }
    //     });
    //   }

    // }
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

  // role spécial pour les validateurs DFI apres action commercial (KAM)
  if (ROLE_VERIFIER) {
    for (const name of specificPermissionForVERIFIER) {
      const db = await prisma.permission.findUnique({
        where: { name: name }
      })

      if (db) {
        await prisma.rolePermission.create({
          data: {
            roleId: ROLE_VERIFIER.id,
            permissionId: db.id,
          }
        });
      }

    }
  }


  // role spécial pour les managers
  const ROLE_MANAGER = await prisma.role.findFirst({
    where: { name: "MANAGER" }
  })
  if (ROLE_MANAGER) {
    for (const name of specificPermissionForManager) {
      const db = await prisma.permission.findUnique({
        where: { name: name }
      })

      if (db) {
        await prisma.rolePermission.create({
          data: {
            roleId: ROLE_MANAGER.id,
            permissionId: db.id,
          }
        });
      }

    }
  }


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
