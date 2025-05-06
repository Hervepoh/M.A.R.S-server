import { PrismaClient } from '@prisma/client';
import { serviceType } from '../../src/constants/enum';


// Instantiate the Prisma Client
const prisma = new PrismaClient();


// for COMMERCIAL
export const specificPermissionForCOMMERCIAL = [
  // `${serviceType.ASSIGNMENT}-CREATE`,
  `${serviceType.ASSIGNMENT}-READ`,
];

export async function seed_permissions() {
  
  const COMMERCIAL_ROLE = await prisma.role.findUnique({
    where: { name: 'USER' }
  })

 if (COMMERCIAL_ROLE) {
  for (const permission of specificPermissionForCOMMERCIAL) {
    const db = await prisma.permission.findUnique({
      where: { name: permission }
    })
    if (db) {
      const rp = await prisma.rolePermission.create({
        data: {
          roleId: COMMERCIAL_ROLE.id,
          permissionId: db.id,
        }
      });
    }

  }

 }
 

}


  
seed_permissions();