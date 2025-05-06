import { NextFunction, Request, Response } from 'express';

import prismaClient from '../core/utils/prismadb';
import { bulkCreateSchema, bulkDeleteSchema, roleSchema } from '../schema/roles';
import NotFoundException from '../core/exceptions/not-found';
import { ErrorCode } from '../core/exceptions/http-exception';
import { redis } from '../core/utils/redis';
import BadRequestException from '../core/exceptions/bad-requests';

const key = 'roles';

//-----------------------------------------------------------------------------
//             CREATE ROLES : post /roles
//-----------------------------------------------------------------------------

// IRoleRequest
interface IRoleRequest {
    name: string;
}

// Handling create role process
export const create =
    async (req: Request, res: Response, next: NextFunction) => {
        // Validate input
        const parsedRole = roleSchema.parse(req.body as IRoleRequest);

        // Check if role already exists
        const existingRole = await prismaClient.role.findUnique({
            where: { name: parsedRole.name },
        });

        if (existingRole) {
            return res.status(409).json({
                success: false,
                message: 'Role with this name already exists',
            });
        }

        // Transaction for atomic operations
        const result = await prismaClient.$transaction(async (prisma) => {
            // Create the role
            const role = await prisma.role.create({
                data: {
                    name: parsedRole.name,
                    description: parsedRole.description,
                },
            });

            // Handle permissions if provided
            if (parsedRole.permissionsId && parsedRole.permissionsId.length > 0) {
                // Verify all permissions exist in single query
                const existingPermissions = await prisma.permission.findMany({
                    where: {
                        id: { in: parsedRole.permissionsId },
                    },
                    select: { id: true },
                });

                // Check for missing permissions
                if (existingPermissions.length !== parsedRole.permissionsId.length) {
                    const missingPermissions = parsedRole.permissionsId.filter(
                        id => !existingPermissions.some(p => p.id === id)
                    );
                    throw new Error(`Permissions not found: ${missingPermissions.join(', ')}`);
                }

                // Create role-permission relations
                await prisma.rolePermission.createMany({
                    data: parsedRole.permissionsId.map(permissionId => ({
                        roleId: role.id,
                        permissionId,
                    })),
                    skipDuplicates: true,
                });
            }

            return role;
        });

        revalidateService(key);

        res.status(201).json({
            success: true,
            data: result
        });
    };


//-----------------------------------------------------------------------------
//             GET ALL ROLES :  get /roles
//-----------------------------------------------------------------------------

// Handling the process GET roles 
export const get =
    async (req: Request, res: Response, next: NextFunction) => {
        let data;
        const redis_data = await redis.get(key);
        if (redis_data) {
            data = JSON.parse(redis_data);
        } else {
            data = await revalidateService(key);
        }
        const roles = await prismaClient.role.findMany();
        res.status(200).json({
            success: true,
            data: roles
        });
    };


export const getWithPermissionPaginationAndComplexeFilterFeature = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Extract pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // Extract and parse filters
        const filters = req.query.filters as string || '';
        let parsedFilters;

        try {
            parsedFilters = filters ? JSON.parse(filters) : {};
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON format for filters. Please provide valid JSON.'
            });
        }

        const whereClause: any = [];

        // Function to create a Prisma filter from provided filter data
        const createFilter = ({ field, operator, value }: { field: string; operator: string; value: any }) => {
            if (!field || value === undefined) {
                throw new Error(`Each filter must include 'field' and 'value'.`);
            }

            const prismaOperatorMap: any = {
                contains: { contains: value },
                equals: { equals: value },
            };

            const prismaCondition = prismaOperatorMap[operator];
            if (!prismaCondition) {
                throw new Error(`Operator '${operator}' is not supported.`);
            }

            return { [field]: prismaCondition };
        };

        // Process conditions
        if (Array.isArray(parsedFilters.conditions)) {
            for (const condition of parsedFilters.conditions) {
                const { operator, filters: conditionFilters } = condition;

                if (!Array.isArray(conditionFilters) || !conditionFilters.length) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each condition must include an array of filters.'
                    });
                }

                const conditionObject = conditionFilters.map(createFilter);
                const combinedCondition = operator === 'AND' ? { AND: conditionObject } : { OR: conditionObject };
                whereClause.push(combinedCondition);
            }
        } else {
            // Process simple filters
            for (const key in parsedFilters) {
                const { operator = 'equals', value } = parsedFilters[key];
                whereClause.push(createFilter({ field: key, operator, value }));
            }
        }

        // Combine final where clause
        const combinedWhereClause = whereClause.length ? { AND: whereClause } : {};

        // Get the total count of records
        const totalItems = await prismaClient.v_role_permissions.count({
            where: combinedWhereClause,
        });

        // Fetch paginated records
        const data = await prismaClient.v_role_permissions.findMany({
            where: combinedWhereClause,
            orderBy: { role: 'asc' },
            skip,
            take: limit,
        });

        // Respond with data and pagination info
        res.status(200).json({
            success: true,
            data,
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
        });
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        res.status(500).json({ success: false, message: errorMessage });
    }
};



//-----------------------------------------------------------------------------
//             GET ROLE BY ID : get /roles/:id
//-----------------------------------------------------------------------------

// Handling the process GET role by ID 
export const getById =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id || typeof id !== 'string') throw new BadRequestException('Invalid role ID format', ErrorCode.INVALID_DATA)

        // const role = await prismaClient.role.findUnique({
        //     where: { id: id },
        // });
        // if (!role) throw new NotFoundException("Role not found", ErrorCode.RESSOURCE_NOT_FOUND);
        // Récupération du rôle avec ses permissions
        const roleWithPermissions = await prismaClient.role.findUnique({
            where: { id },
            include: {
                RolePermission: {
                    select: {
                        permissionId: true,
                    }
                }
            }
        });

        if (!roleWithPermissions) {
            return res.status(404).json({
                success: false,
                error: 'Role not found'
            });
        }

        // Formatage de la réponse
        const response = {
            ...roleWithPermissions,
            permissionsId: roleWithPermissions.RolePermission.map(p => p.permissionId),
        };

        res.status(200).json({
            success: true,
            data: response
        });

    };

//-----------------------------------------------------------------------------
//             UPDATE ROLE : put  /roles/:id
//-----------------------------------------------------------------------------

// Handling Update role process
export const update =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id || typeof id !== 'string') throw new BadRequestException('Invalid role ID format', ErrorCode.INVALID_DATA)

        const parsedRole = roleSchema.parse(req.body); // Validate input


        // Transaction pour garantir l'intégrité des données
        const updatedRole = await prismaClient.$transaction(async (prisma) => {
            // 1. Mise à jour des informations de base du rôle
            const role = await prisma.role.update({
                where: { id },
                data: {
                    name: parsedRole.name,
                    description: parsedRole.description
                }
            });

            // 2. Mise à jour des permissions si elles sont fournies
            if (parsedRole.permissionsId) {
                // Supprimer d'abord toutes les permissions existantes
                await prisma.rolePermission.deleteMany({
                    where: { roleId: id }
                });

                // Vérifier que toutes les permissions existent
                const existingPermissions = await prisma.permission.findMany({
                    where: {
                        id: { in: parsedRole.permissionsId }
                    }
                });

                if (existingPermissions.length !== parsedRole.permissionsId.length) {
                    const missingPermissions = parsedRole.permissionsId.filter(
                        permId => !existingPermissions.some(p => p.id === permId)
                    );
                    throw new Error(`Permissions not found: ${missingPermissions.join(', ')}`);
                }

                // Ajouter les nouvelles permissions
                await prisma.rolePermission.createMany({
                    data: parsedRole.permissionsId.map(permissionId => ({
                        roleId: id,
                        permissionId
                    }))
                });
            }

            // Récupérer le rôle avec ses permissions mises à jour
            return await prisma.role.findUnique({
                where: { id },
                include: {
                    RolePermission: {
                        select: {
                            permissionId: true,
                        }
                    }
                }
            });
        });

        revalidateService(key);

        // Formatage de la réponse
        const response = {
            ...updatedRole,
            permissionsId: updatedRole?.RolePermission.map(p => p.permissionId)
        };

        res.status(200).json({
            success: true,
            data: response
        });

    };


//-----------------------------------------------------------------------------
//             DELETE ROLE : delete  /roles/:id
//-----------------------------------------------------------------------------

// Handling delete role process
export const remove =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

        // Validation of ID
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Invalid role ID format'
            });
        }

        // Vérifier l'existence du rôle avant suppression
        const existingRole = await prismaClient.role.findUnique({
            where: { id }
        });

        if (!existingRole) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Transaction pour supprimer le rôle et ses relations
        await prismaClient.$transaction(async (prisma) => {
            // D'abord supprimer les permissions associées
            await prisma.rolePermission.deleteMany({
                where: { roleId: id }
            });

            // Puis supprimer le rôle
            await prisma.role.delete({
                where: { id }
            });
        });

        // Invalidation du cache si nécessaire
        revalidateService(key);

        res.status(204).send(); // No content

    };


//-----------------------------------------------------------------------------
//             BULK-CREATE ROLE : post /roles
//-----------------------------------------------------------------------------

// IBulkCreateRequest interface definition
interface IBulkCreateRequest {
    data: { name: string }[];
}

// Handling create role process
export const bulkCreate = async (req: Request, res: Response, next: NextFunction) => {

    // Validate input
    const parsedData = bulkCreateSchema.parse(req.body as IBulkCreateRequest);

    // Check for duplicate role names
    const existingRessources = await Promise.all(parsedData.data.map(async item => {
        return await prismaClient.role.findFirst({ where: { name: item.name } });
    }));

    const duplicates = existingRessources.filter(item => item);
    if (duplicates.length > 0) {
        return res.status(422).json({
            success: false,
            message: "Duplicate setting names found",
            duplicates: duplicates.map(item => item?.name)
        });
    }

    // Create roles
    const createdRoles = await Promise.all(parsedData.data.map(role =>
        prismaClient.role.create({ data: role })
    ));

    revalidateService(key);

    res.status(201).json({
        success: true,
        data: createdRoles
    });

};

//-----------------------------------------------------------------------------
//             BULK-DELETE ROLE : delete  /roles/bulk
//-----------------------------------------------------------------------------

// IBulkCreateRequest
interface IBulkDeleteRequest {
    data: { id: string }[];
}

// Handling bulk delete role process
export const bulkRemove = async (req: Request, res: Response, next: NextFunction) => {

    // Validate input using Zod
    const { ids } = bulkDeleteSchema.parse(req.body);

    // Perform bulk delete
    const deleteResult = await prismaClient.role.deleteMany({
        where: {
            id: { in: ids } // Use 'in' to delete all matching IDs in one query
        }
    });

    revalidateService(key);

    // Send response
    res.status(204).send(); // No content

};


//-----------------------------------------------------------------------------
//             ASSIGN PERMISSION TO ROLE : delete  /roles/:id
//-----------------------------------------------------------------------------

// IPermissionAssignRequest
type IPermissionAssignRequest = {
    roleId: string;
    permissionId: string
}

// Function to assign permission to a role
export const assignPermission = async (req: Request, res: Response, next: NextFunction) => {
    const { roleId, permissionId }: IPermissionAssignRequest = req.body;
    if (!roleId || !permissionId) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

    // Check if the role exists
    const role = await prismaClient.role.findUnique({
        where: { id: roleId },
    });
    if (!role) throw new NotFoundException("Role not found", ErrorCode.RESSOURCE_NOT_FOUND);

    // Check if the permission exists
    const permission = await prismaClient.permission.findUnique({
        where: { id: permissionId },
    });
    if (!permission) throw new NotFoundException("Permission not found", ErrorCode.RESSOURCE_NOT_FOUND);

    // Assign the permission to the role
    await prismaClient.rolePermission.create({
        data: {
            roleId,
            permissionId,
        },
    });
    revalidateService(key);

    res.status(201).json({
        success: true,
        message: "Permission assigned to role successfully."
    });

};


// Function to get all permission assign to a role
export const getPermissions = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

    // Récupérer le rôle avec ses permissions associées
    const roleWithPermissions = await prismaClient.role.findUnique({
        where: { id: id },
        include: {
            RolePermission: true, // Inclure les permissions associées
        },
    });
    if (!roleWithPermissions) throw new NotFoundException("Role not found", ErrorCode.RESSOURCE_NOT_FOUND);

    res.status(200).json({
        success: true,
        role: {
            id: roleWithPermissions.id,
            name: roleWithPermissions.name,
            permissions: roleWithPermissions.RolePermission, // Retourner les permissions
        },
    });

};


const revalidateService = async (key: string) => {
    const data = await prismaClient.role.findMany({
        orderBy: {
            name: 'asc',
        },
    });
    await redis.set(key, JSON.stringify(data));
    return data
}