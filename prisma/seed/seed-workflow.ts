// prisma/seed.ts
import { ApprovalPolicy, PrismaClient, TicketStatus } from '@prisma/client';
import { ValidationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {

  // 1. Nettoyer la base existante
  await prisma.$transaction([
    prisma.ticketHistory.deleteMany(),
    prisma.ticketWorkflow.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.workflowTransition.deleteMany(),
    prisma.workflowValidationRole.deleteMany(),
    prisma.workflowValidationUser.deleteMany(),
    prisma.workflowValidation.deleteMany(),
    prisma.workflowStep.deleteMany(),
    prisma.workflow.deleteMany(),
  ]);

  const decRole = await prisma.role.findFirst({
    where: {
      name: 'ADMIN'
    }
  })
  const drRole = await prisma.role.findFirst({
    where: {
      name: 'MANAGER'
    }
  })
  if (!decRole) return
  if (!drRole) return

  // Créer un workflow de validation
  const validationWorkflow = await prisma.workflow.create({
    data: {
      name: 'default',
      description: 'Workflow pour la validation des documents avec DEC et DR',
      isActive: true,
      isDefault: true,
      createdBy: 'system-seeder',
      updatedBy: 'system-seeder',
      Steps: {
        create: [
          {
            name: 'Validation DEC',
            description: 'En attente de validation DEC',
            order: 1,
            Validations: {
              create: {
                type: ValidationType.ROLE,
                requiredApprovals: 1,
                approvalPolicy: ApprovalPolicy.ALL,
                ValidationRoles: {
                  create: {
                    roleId: decRole.id
                  }
                }
              }
            }
          },
          {
            name: 'Validation DR',
            description: 'En attente de validation DR',
            order: 2,
            Validations: {
              create: {
                type: ValidationType.ROLE,
                requiredApprovals: 1,
                approvalPolicy: ApprovalPolicy.ALL,
                ValidationRoles: {
                  create: {
                    roleId: drRole.id
                  }
                }
              }
            }
          }
        ]
      }
    },
    include: {
      Steps: {
        include: {
          Validations: {
            include: {
              ValidationRoles: true
            }
          }
        }
      }
    }
  });

  // Créer les transitions entre les étapes
  await prisma.workflowTransition.create({
    data: {
      fromStepId: validationWorkflow.Steps[0].id,
      toStepId: validationWorkflow.Steps[1].id,
      conditionType: 'EXPRESSION',
      conditionValue: 'approved == true'
    }
  });

  console.log('Workflow créé avec succès:', validationWorkflow);


  // 5. Création d'un ticket de test
  // const testTicket = await prisma.ticket.create({
  //   data: {
  //     reference: 'DOC-2023-001',
  //     status: TicketStatus.NEW,
  //     workflowId: validationWorkflow.id,
  //     workflowcurrentStepId: validationWorkflow.steps[0].id,
  //     createdBy: 'system-seeder',
  //     updatedBy: 'system-seeder',
  //   }
  // });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });