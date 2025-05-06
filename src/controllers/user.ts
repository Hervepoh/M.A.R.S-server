import { NextFunction, Request, Response } from "express";
import ejs from "ejs";
import path from "path";
import bcrypt from "bcrypt";

import { redis } from "../core/utils/redis";
import prismaClient from "../core/utils/prismadb";
import sendMail from "../core/utils/sendMail";
import BadRequestException from "../core/exceptions/bad-requests";
import UnprocessableException from "../core/exceptions/validation";
import HttpException, { ErrorCode } from "../core/exceptions/http-exception";
import { acceptablePasswordPolicy, isAnAcceptablePassword, isValidEmail, isValidPassword, passwordPolicy } from "../core/utils/validator";
import { MAIL_NO_REPLY, SALT_ROUNDS } from "../secrets";
import { idSchema, signUpSchema, updateSchema, userRoleSchema } from "../schema/users";
import { NotificationMethod } from "@prisma/client";
import NotFoundException from "../core/exceptions/not-found";
import UnauthorizedException from "../core/exceptions/unauthorized";
import InternalException from "../core/exceptions/internal-exception";


const key = 'users';

//-----------------------------------------------------------------------------
//             CREATE USERS : post /users
//-----------------------------------------------------------------------------
interface IUser {
    name: string;
    email: string;
    phone?: string;
    unitId?: string;
    password: string;
    ldap?: boolean;
    avatar?: string;
    roleId?: string | string[];
}

// Handling create user process
export const create = async (req: Request, res: Response, next: NextFunction) => {
    // Validate input
    signUpSchema.parse(req.body);

    const { name, email, phone, password, unitId, roleId, ldap } = req.body as IUser;

    if (!isAnAcceptablePassword(password)) {
        throw new BadRequestException(`Invalid Password : ${acceptablePasswordPolicy}`, ErrorCode.INVALID_DATA);
    }

    const isEmailAlreadyExist = await prismaClient.user.findFirst({
        where: { email }
    });
    if (isEmailAlreadyExist) throw new UnauthorizedException(`There is already a user with the email : ${email}`, ErrorCode.INVALID_DATA);

    const isNameAlreadyExist = await prismaClient.user.findFirst({
        where: { name }
    });
    if (isNameAlreadyExist) throw new UnauthorizedException(`There is already a user with the name : ${name}`, ErrorCode.INVALID_DATA);

    let unit: { id: string } | null = null
    if (unitId) {
        unit = await prismaClient.unit.findUnique({
            where: { id: unitId }
        });
        if (!unit) throw new BadRequestException(`Invalid UnitId : ${unitId}`, ErrorCode.INVALID_DATA);
    }

    // Create user
    const user = await prismaClient.user.create({
        data: {
            name,
            email,
            phone,
            password: await bcrypt.hash(password, parseInt(SALT_ROUNDS || '10')),
            ldap,
            unitId: unit?.id
        }
    });
    // let role;
    // if (!roleId) {
    //     // default role
    //     role = await prismaClient.role.findFirst({
    //         where: { name: "USER" }
    //     });
    // } else {
    //     role = await prismaClient.role.findUnique({
    //         where: { id: roleId }
    //     });
    // }
    // if (!role) throw new BadRequestException(`Something went wrong`, ErrorCode.INVALID_DATA);

    // Assign default role
    // await prismaClient.userRole.create({
    //     data: {
    //         userId: user.id,
    //         roleId: role.id,
    //     }
    // });

    const assignedRoles = new Set<string>();

    if (roleId) {
        if (typeof roleId === 'string') {
            // Si roleId est une chaîne, on l'ajoute directement
            const role = await prismaClient.role.findUnique({ where: { id: roleId } });
            if (role) assignedRoles.add(role.id);
        } else if (Array.isArray(roleId)) {
            // Si roleId est un tableau, on le traite en boucle
            for (const id of roleId) {
                const role = await prismaClient.role.findUnique({ where: { id } });
                if (role) assignedRoles.add(role.id);
            }
        }
    }

    // Assignation des rôles à l'utilisateur
    for (const roleId of assignedRoles) {
        await prismaClient.userRole.create({
            data: {
                userId: user.id,
                roleId,
            }
        });
    }

    const message = ldap
        ? `**Email**: ${user.email} \n\n Please use your Outlook password to log in.`
        : `**Email**: ${user.email} \n\n  **Temporary Password**: ${password}.`;

    // User notification by mail
    await prismaClient.notification.create({
        data: {
            email: user.email,
            message: message,
            method: NotificationMethod.EMAIL,
            subject: "Your account has been created successfully.",
            template: "new.mail.ejs",
        },
    });
    revalidateService(key);
    revalideCommercialListService(key);

    res.status(201).json({
        success: true,
        data: user
    });

};


//-----------------------------------------------
//       Get All Users : get users
//-----------------------------------------------

// Handling the process GET users information 
export const get =
    async (req: Request, res: Response, next: NextFunction) => {
        const usersJSON = await redis.get(key);
        if (usersJSON) {
            const data = JSON.parse(usersJSON);
            res.status(200).json({
                success: true,
                data,
            });
        } else {
            const data = await revalidateService(key);

            res.status(200).json({
                success: true,
                data,
            });
        }
    };


export const getWithPaginationAndComplexeFilterFeatureOptimizeForPrisma = async (req: Request, res: Response, next: NextFunction) => {
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
                gte: { gte: value },
                lte: { lte: value },
                gt: { gt: value },
                lt: { lt: value }
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
        const totalItems = await prismaClient.v_users.count({
            where: combinedWhereClause,
        });

        // Fetch paginated records
        const data = await prismaClient.v_users.findMany({
            where: combinedWhereClause,
            orderBy: { createdAt: 'desc' },
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


//-----------------------------------------------
//       Get All Users : get users
//-----------------------------------------------

// Handling the process GET users information 
export const getPublic =
    async (req: Request, res: Response, next: NextFunction) => {
        const public_key = key + '_public'
        const usersJSON = await redis.get(public_key);
        if (usersJSON) {
            const data = JSON.parse(usersJSON);
            res.status(200).json({
                success: true,
                data,
            });
        } else {
            const data = await revalidePublicistService(public_key);

            res.status(200).json({
                success: true,
                data,
            });
        }
    };

//-----------------------------------------------
//       Get All Users : get users
//-----------------------------------------------

// Handling the process GET users information 
export const getCommercialUsers =
    async (req: Request, res: Response, next: NextFunction) => {
        const usersJSON = await redis.get(key + '_role_commercial');
        if (usersJSON) {
            const data = JSON.parse(usersJSON);
            res.status(200).json({
                success: true,
                data,
            });
        } else {
            const data = await revalideCommercialListService(key + '_role_commercial');
            res.status(200).json({
                success: true,
                data,
            });
        }
    };


//-----------------------------------------------------------------------------
//             GET USER BY ID : get /users/:id
//-----------------------------------------------------------------------------

// Handling the process GET user by ID 
export const getById =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

        const data = await prismaClient.v_users_id.findUnique({
            where: { id: id },
        });
        if (!data) throw new NotFoundException("User not found", ErrorCode.RESSOURCE_NOT_FOUND);

        const userData = {
            id: data.id,
            name: data.name,
            email: data.email,
            ldap: data.ldap,
            password: data.password,
            isActive: data.isActive,
            deleted: data.deleted,
            roleId: data.roleId
                ? data.roleId.split(',').map(role => role.trim()) // Split(Convert comma-separated roles to an array) and trim each role
                : [], // Default to an empty array if no roles
            unitId: data.unitId,
        };

        res.status(200).json({
            success: true,
            data: userData
            //data: data
        });

    };


//-----------------------------------------------------------------------------
//             UPDATE USER : put  /users/:id
//-----------------------------------------------------------------------------

// Handling  user udpdate process
export const update =
    async (req: Request, res: Response, next: NextFunction) => {

        const { id } = req.params;

        // Validate ID
        if (!id) {
            throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);
        }

        if (!idSchema.parse(id)) {
            throw new BadRequestException('Invalid ID format', ErrorCode.INVALID_DATA);
        }

        // Validate input
        const parsedInput = updateSchema.parse(req.body);

        // Check if user exists
        const user = await prismaClient.user.findUnique({
            where: { id: id },
        });

        if (!user) {
            throw new BadRequestException('User not found', ErrorCode.INVALID_DATA);
        }

        // Validate unit ID if provided
        let unit: { id: string; } | null = null
        if (parsedInput.unitId) {
            unit = await prismaClient.unit.findUnique({
                where: { id: parsedInput.unitId }
            });
            if (!unit) throw new BadRequestException('Invalid Unit ID', ErrorCode.INVALID_DATA);
        }

        // Handle password update
        let newPassword = user.password; // Default to the current password
        if (parsedInput.password && parsedInput.password !== newPassword) {
            const isMatch = await bcrypt.compare(parsedInput.password, user.password);
            if (!isMatch) {
                newPassword = await bcrypt.hash(parsedInput.password, parseInt(SALT_ROUNDS || '10'));
            } else {
                console.warn('New password matches the old password; no update performed.');
            }
        }

        // Validate role IDs if provided

        let roleIdsToUpdate = parsedInput.roleId || []; // Use provided role IDs or default to an empty array
        let invalidRoleIds = []; // Array to collect invalid role IDs

        if (roleIdsToUpdate.length > 0) {
            const validRoles = await prismaClient.role.findMany({
                where: { id: { in: roleIdsToUpdate } },
            });

            // Identify invalid role IDs
            const validRoleIds = validRoles.map(role => role.id);
            invalidRoleIds = roleIdsToUpdate.filter(roleId => !validRoleIds.includes(roleId));

            if (invalidRoleIds.length > 0) {
                throw new InternalException(
                    'One or more Role IDs are invalid',
                    { invalidRoleIds }, // Include the invalid role IDs in the error response
                    ErrorCode.INVALID_DATA,
                );
            }

            // Fetch existing roles for the user
            // const userRoles = await prismaClient.userRole.findMany({
            //     where: { userId: user.id },
            // });
            // const existingRoleIds = userRoles.map(role => role.roleId);

            // Determine new roles to add (not already assigned)
            const newRolesToAdd = validRoleIds // validRoleIds.filter(roleId => !existingRoleIds.includes(roleId));
            roleIdsToUpdate = [...new Set([...newRolesToAdd])]; // Combine existing and new roles without duplicates
            await prismaClient.userRole.deleteMany({ where: { userId: user.id } });

        } else {

            // If no role IDs provided, delete all roles assigned to this user
            await prismaClient.userRole.deleteMany({ where: { userId: user.id } });
            roleIdsToUpdate = []; // Clear roles as all will be deleted
        }

        // Prepare data for update
        const data = {
            name: parsedInput.name || user.name,
            email: parsedInput.email || user.email,
            phone: parsedInput.phone || user.phone,
            ldap: parsedInput.ldap !== undefined ? parsedInput.ldap : user.ldap,
            unitId: parsedInput.unitId && unit ? unit.id : user.unitId,
            password: newPassword,
        };

        // Update user in the database
        const updatedUser = await prismaClient.user.update({
            where: { id },
            data,
        });

        // Update userRoles in the database
        await Promise.all(roleIdsToUpdate.map(roleId =>
            prismaClient.userRole.upsert({
                where: { userId_roleId: { userId: user.id, roleId } },
                create: { userId: user.id, roleId },
                update: { roleId },
            })
        ));

        // Revalidate services
        revalidateService(key);
        revalideCommercialListService(key + '_role_commercial');
        revalidePublicistService(key + '_public')
        res.status(200).json({
            success: true,
            data: { updatedUser, roles: [] }
        });

    };


//-----------------------------------------------------------------------------
//             DELETE USER : delete  /users/:id
//-----------------------------------------------------------------------------

// Handling delete user process
export const remove =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)
        if (!idSchema.parse(id)) throw new BadRequestException('Invalid ID format', ErrorCode.INVALID_DATA)

        await prismaClient.userRole.deleteMany({
            where: { userId: id }
        });

        await prismaClient.user.delete({
            where: { id: id }
        });
        revalidateService(key);
        revalideCommercialListService(key);

        res.status(204).send(); // No content

    };


//-----------------------------------------------------------------------------
//             UPDATE USER : put  /users/:id/disactive-reactive
//-----------------------------------------------------------------------------

// Handling  user udpdate process
export const disactiveReactive =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)
        if (!idSchema.parse(id)) throw new BadRequestException('Invalid ID format', ErrorCode.INVALID_DATA)

        const user = await prismaClient.user.findUnique({
            where: { id: id },
        });

        if (!user) throw new NotFoundException('User not found', ErrorCode.USER_NOT_FOUND)
        if (user.name == 'admin') throw new UnauthorizedException('Super Admin can not be disable', ErrorCode.USER_NOT_FOUND)

        const data = await prismaClient.user.update({
            where: { id: id },
            data: { isActive: !user.isActive, isInActiveAt: user.isActive ? null : new Date() },
        });
        revalidateService(key);
        revalideCommercialListService(key + '_role_commercial');
        revalidePublicistService(key + '_public')
        res.status(200).json({
            success: true,
            status: data.isActive ? 'active' : 'inactive',
            data: data
        });

    };



//-----------------------------------------------------------------------------
//             SOFTDELETE USER : softdelete  /users/:id
//-----------------------------------------------------------------------------

// Handling delete user process
export const softremove =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)
        if (!idSchema.parse(id)) throw new BadRequestException('Invalid ID format', ErrorCode.INVALID_DATA)

        const user = await prismaClient.user.findUnique({
            where: { id: id },
        });

        if (!user) throw new NotFoundException('User not found', ErrorCode.USER_NOT_FOUND)
        if (user.name == 'admin') throw new UnauthorizedException('Super Admin can not be deleted', ErrorCode.USER_NOT_FOUND)

        await prismaClient.user.update({
            where: { id: id },
            data: { deleted: true, isInActiveAt: new Date() },
        });
        revalidateService(key);
        revalideCommercialListService(key);

        res.status(204).send(); // No content

    };


//-----------------------------------------------
//              get user notifications
//-----------------------------------------------
export const getUserNotification =
    async (req: Request, res: Response, next: NextFunction) => {

        if (!req.user?.id) {
            throw new BadRequestException('Please first login if you want to achieve this action', ErrorCode.INVALID_DATA)
        }


        const notifications = await prismaClient.notification
            .findMany(
                {
                    where: {
                        userId: req.user.id, // Récupérer les notifications pour l'utilisateur spécifique
                        NOT: {
                            userId: null, // Exclure les notifications où userId est null
                        },
                    },
                }
            )

        res.status(200).json({
            success: true,
            notifications,
        });
    };



//---------------------------------------------------------------------
//              Update User role /user/role -- only for admin users
//---------------------------------------------------------------------

interface IUpdateUserRoleRequest {
    userId: string;
    roleId: string;
}

export const addUserRole =
    async (req: Request, res: Response, next: NextFunction) => {
        const parsedData = userRoleSchema.parse(req.body as IUpdateUserRoleRequest);
        if (!parsedData) throw new BadRequestException("Invalid data provided please ckeck the documentation", ErrorCode.INVALID_DATA);


        const user = await prismaClient.user.findUnique({
            where: { id: parsedData.userId },
        });
        if (!user) throw new NotFoundException("User not found", ErrorCode.RESSOURCE_NOT_FOUND);

        const role = await prismaClient.role.findUnique({
            where: { id: parsedData.roleId },
        });
        if (!role) throw new NotFoundException("Role not found", ErrorCode.RESSOURCE_NOT_FOUND);

        await prismaClient.userRole.create({
            data: parsedData,
        });

        res.status(200).json({
            success: true,
            message: "Role added successfully",
        });

        revalidateService(key);
        revalideCommercialListService(key + '_role_commercial');
    };


export const removeUserRole =
    async (req: Request, res: Response, next: NextFunction) => {

        const parsedData = userRoleSchema.parse(req.body as IUpdateUserRoleRequest);
        if (!parsedData) throw new BadRequestException("Invalid data provided please ckeck the documentation", ErrorCode.INVALID_DATA);

        const redis_roles = await redis.get('roles');
        const data = JSON.parse(redis_roles || '');

        const user = await prismaClient.user.findUnique({
            where: { id: parsedData.userId },
        });
        if (!user) throw new NotFoundException("User not found", ErrorCode.RESSOURCE_NOT_FOUND);

        const role = await prismaClient.role.findUnique({
            where: { id: parsedData.roleId },
        });
        if (!role) throw new NotFoundException("Role not found", ErrorCode.RESSOURCE_NOT_FOUND);


        await prismaClient.userRole.delete({
            where: {
                userId_roleId: {
                    userId: parsedData.userId,
                    roleId: parsedData.roleId,
                },
            },
        });

        res.status(200).json({
            success: true,
            message: "Role removed successfully",
        });

        revalidateService(key);
        revalideCommercialListService(key + '_role_commercial');

    };


const revalidateService = async (key: string) => {
    const data = await prismaClient.v_users.findMany();
    await redis.set(key, JSON.stringify(data));
    return data
}

const revalideCommercialListService = async (key: string) => {
    const data = await prismaClient.user.findMany({
        where: {
            roles: {
                some: {
                    role: {
                        name: 'COMMERCIAL',
                    },
                },
            },
        },
        select: {
            id: true,
            name: true,
            email: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    await redis.set(key + '_role_commercial', JSON.stringify(data));
    return data
}

const revalidePublicistService = async (key: string) => {
    const data = await prismaClient.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    await redis.set(key, JSON.stringify(data));
    return data
}