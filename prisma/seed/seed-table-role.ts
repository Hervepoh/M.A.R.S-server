import { PrismaClient } from '@prisma/client';

// Instantiate the Prisma Client
const prisma = new PrismaClient();

interface RoleDefinition {
  name: string;
  description: string;
}

// List of roles 
const roles: RoleDefinition[] = [
  {
    name: 'ADMIN',
    description: 'Accès complet à toutes les fonctionnalités du système avec droits administratifs'
  },
  {
    name: 'ADMIN-TECHNIQUE',
    description: 'Administrateur technique responsable de la maintenance et des configurations système'
  },
  {
    name: 'ADMIN-FUNCTIONAL',
    description: 'Administrateur fonctionnel gérant les processus métiers et les workflows'
  },
  {
    name: 'AUDITOR',
    description: 'Accès en lecture seule pour auditer les activités et données du système'
  },
  {
    name: 'USER',
    description: 'Utilisateur standard avec accès aux fonctionnalités de base'
  },
  {
    name: 'VALIDATOR',
    description: 'Peut approuver ou rejeter les transactions et demandes spécifiques'
  },
  {
    name: 'ASSIGNATOR',
    description: 'Responsable de l\'assignation des tâches et des ressources'
  },
  {
    name: 'COMMERCIAL',
    description: 'Accès aux fonctionnalités liées aux ventes et à la gestion client'
  },
  {
    name: 'VERIFIER',
    description: 'Peut vérifier et confirmer les informations sans droits de modification'
  },
  {
    name: 'MANAGER',
    description: 'Gestionnaire d\'équipe avec accès aux rapports et statistiques'
  }
];

export async function seed_roles() {
  const rolePromises = roles.map(role =>
    prisma.role.create({
      data: { 
        name: role.name,
        description: role.description,
      },
    })
  );
  const createdRoles = await Promise.all(rolePromises);
  console.log(`Created roles: ${roles.join(', ')}`);
  createdRoles.forEach(item => {
    console.log(`Created role [${item.name}] with id: ${item.id}`);
  });
  return createdRoles;
}
