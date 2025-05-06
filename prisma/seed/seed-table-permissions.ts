import { PrismaClient } from '@prisma/client';
import { serviceType } from '../../src/constants/enum';


// Instantiate the Prisma Client
const prisma = new PrismaClient();

// Begin declarate List of permissions
const services = Object.values(serviceType);

// Définition du type pour les permissions
interface PermissionDefinition {
  name: string;
  description: string;
}

// export const permissions = [
//   'CREATE', 'READ', 'WRITE', 'UPDATE', 'DELETE', 'BULKCREATE', 'BULKDELETE', 'SEARCH'
// ];
// Permissions de base avec descriptions
const basePermissions: PermissionDefinition[] = [
  { name: 'CREATE', description: 'Permission de créer une ressource' },
  { name: 'READ', description: 'Permission de lire une ressource' },
  { name: 'WRITE', description: 'Permission d\'écrire dans une ressource' },
  { name: 'UPDATE', description: 'Permission de mettre à jour une ressource' },
  { name: 'DELETE', description: 'Permission de supprimer une ressource' },
  { name: 'BULKCREATE', description: 'Permission de créer plusieurs ressources en masse' },
  { name: 'BULKDELETE', description: 'Permission de supprimer plusieurs ressources en masse' },
  { name: 'SEARCH', description: 'Permission de rechercher des ressources' },
];
// export const customPermissions = [
//   "ICN-NEXTCODE", 'ICN-NEXTDEMATERIALIZATION', "ICN-GROUPES", "ICN-DOCUMENTS",
//   "USER-READNOTIFICATION", "USER-ROLE", "USER-ADDROLE", "USER-REMOVEROLE", "USER-NOTIFICATION",
//   "TRANSACTION-PUBLISH", "TRANSACTION-VALIDATE", "TRANSACTION-ASSIGN", "TRANSACTION-COMMERCIAL", "TRANSACTION-VERIFIER",
//   "SUMMARY-README",
//   "ASSIGNMENT-README",
// ];
// Permissions custom avec descriptions
const customPermissions: PermissionDefinition[] = [
  { name: "ICN-NEXTCODE", description: "Permission de générer le prochain code ICN" },
  { name: 'ICN-NEXTDEMATERIALIZATION', description: "Permission de dématerlialisation ICN" },
  { name: "ICN-GROUPES", description: "Permission de gérer les groupes ICN" },
  { name: "ICN-DOCUMENTS", description: "Permission d'accès aux documents ICN" },
  { name: "USER-READNOTIFICATION", description: "Permission de lire les notifications utilisateur" },
  { name: "USER-ROLE", description: "Permission de gérer les rôles utilisateur" },
  { name: "USER-ADDROLE", description: "Permission d'ajouter un rôle à un utilisateur" },
  { name: "USER-REMOVEROLE", description: "Permission de retirer un rôle à un utilisateur" },
  { name: "USER-NOTIFICATION", description: "Permission de gérer les notifications utilisateur" },
  { name: "TRANSACTION-PUBLISH", description: "Permission de publier une transaction" },
  { name: "TRANSACTION-VALIDATE", description: "Permission de valider une transaction" },
  { name: "TRANSACTION-ASSIGN", description: "Permission d'assigner une transaction" },
  { name: "TRANSACTION-COMMERCIAL", description: "Permission d'accès commercial aux transactions" },
  { name: "TRANSACTION-VERIFIER", description: "Permission de vérifier une transaction" },
  { name: "SUMMARY-README", description: "Permission de lire les résumés" },
  { name: "ASSIGNMENT-README", description: "Permission de lire les assignations" },
];
// End declarate List of permissions


// Begin Listing Specific permissions to be assigned by pofil
// for VERIFIER
export const specificPermissionForVERIFIER = [
  "TRANSACTION-READ", "TRANSACTION-COMMERCIAL",
  "TRANSACTIONDETAIL-READ", "TRANSACTIONDETAIL-WRITE", "TRANSACTIONDETAIL-BULKCREATE", "TRANSACTIONDETAIL-BULKDELETE", "TRANSACTION-VERIFIER",
  `${serviceType.ASSIGNMENT}-README`,
  `${serviceType.ASSIGNMENT}-READ`,
  "SUMMARY-README",
  "BANK-READ",
  "BANKAGENCY-READ",
  "REGION-READ",
  "UNIT-READ",
  "SEGMENT-READ",
  "PAYMENTMODE-READ",
  "UNPAID-SEARCH",
  "ICN-READ",
  "ROLE-READ",
  "USER-READNOTIFICATION"
];
// for COMMERCIAL
export const specificPermissionForCOMMERCIAL = [
  `${serviceType.ASSIGNMENT}-CREATE`,
  `${serviceType.ASSIGNMENT}-README`,
  `${serviceType.ASSIGNMENT}-READ`,
  "TRANSACTION-READ", "TRANSACTION-COMMERCIAL",
  "TRANSACTIONDETAIL-READ", "TRANSACTIONDETAIL-WRITE", "TRANSACTIONDETAIL-BULKCREATE", "TRANSACTIONDETAIL-BULKDELETE",
  "SUMMARY-README",
  "BANK-READ",
  "BANKAGENCY-READ",
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
export const specificPermissionForAssignator = [
  `${serviceType.ASSIGNMENT}-READ`,
  `${serviceType.ASSIGNMENT}-UPDATE`,
  "SUMMARY-READ",
  "TRANSACTION-READ", "TRANSACTION-ASSIGN",
  "BANK-READ",
  "BANKAGENCY-READ",
  "REGION-READ",
  "UNIT-READ",
  "SEGMENT-READ",
  "USER-SEARCH"
];
// for Validation
export const specificPermissionForValidation = [
  "SUMMARY-READ",
  `${serviceType.ASSIGNMENT}-READ`,
  "TRANSACTION-READ",
  "TRANSACTION-VALIDATE",
  "BANK-READ",
  "BANKAGENCY-READ",
  "PAYMENTMODE-READ",
  "SEGMENT-READ",
  "REGION-READ",
  "UNIT-READ",
];
// for Initiator
export const specificPermissionForUSER = [
  "TRANSACTION-READ", "TRANSACTION-WRITE", "TRANSACTION-PUBLISH", "TRANSACTION-BULKCREATE",
  `${serviceType.ASSIGNMENT}-READ`,
  "SUMMARY-README",
  "BANK-READ",
  "BANKAGENCY-READ",
  "PAYMENTMODE-READ",
  "SEGMENT-READ",
  "REGION-READ",
  "UNIT-READ",
  "UNPAID-SEARCH",
  "ICN-READ",
  "ROLE-READ",
  "USER-READNOTIFICATION"
];

// for Manager
export const specificPermissionForManager = [
  `${serviceType.ASSIGNMENT}-READ`,
  "SUMMARY-READ",
  "TRANSACTION-READ",
  "BANK-READ",
  "BANKAGENCY-READ",
  "REGION-READ",
  "UNIT-READ",
  "SEGMENT-READ",
];
// End Listing Specific permissions to be assigned by pofil



export async function seed_permissions() {
  // const servicePermissions = services.flatMap(service =>
  //   permissions.map(permission => `${service}-${permission}`)
  // );
  const servicePermissions = Object.values(serviceType).flatMap(service =>
    basePermissions.map(permission => ({
      name: `${service}-${permission.name}`,
      description: `${permission.description} pour ${service}`
    }))
  );

  // Combinaison de toutes les permissions
  const allPermissions = [...servicePermissions, ...customPermissions];

  // Vérification des permissions existantes
  const existingPermissions = await prisma.permission.findMany();
  const existingNames = new Set(existingPermissions.map(p => p.name));

  // Filtrage des nouvelles permissions à créer
  const permissionsToCreate = allPermissions.filter(
    p => !existingNames.has(p.name)
  );

  if (permissionsToCreate.length > 0) {
    const createdPermissions = await prisma.$transaction(
      permissionsToCreate.map(permission =>
        prisma.permission.create({
          data: {
            name: permission.name,
            description: permission.description,
          }
        })
      )
    );

    console.log('✅ Permissions créées:');
    createdPermissions.forEach(p => {
      console.log(`- ${p.name.padEnd(40)}: ${p.description}`);
    });
    return createdPermissions;
  } else {
    console.log('ℹ️ Toutes les permissions existent déjà');
    return [];
  }

  // // Insert Permissions
  // const permissionPromises = servicePermissions.map(permission =>
  //   prisma.permission.create({
  //     data: { name: permission!

  //      },
  //   })
  // );
  // const createdPermissions = await Promise.all(permissionPromises);
  // console.log(`Created permissions: ${servicePermissions.join(', ')}`);
  // createdPermissions.forEach(item => {
  //   console.log(`Created permission [${item.name}] with id: ${item.id}`);
  // });

  // const customPermissionsPromises = customPermissions.map(item =>
  //   prisma.permission.create({
  //     data: { name: item },
  //   })
  // );
  // const createdCustomPermissions = await Promise.all(customPermissionsPromises);
  // createdCustomPermissions.forEach(item => {
  //   console.log(`Created permission [${item.name}] with id: ${item.id}`);
  // });

  //return {createdPermissions,createdCustomPermissions}
}
