import { NextFunction, Request, Response } from 'express';

import { redis } from '../core/utils/redis';
import prismaClient from '../core/utils/prismadb';
import NotFoundException from '../core/exceptions/not-found';
import { ErrorCode } from '../core/exceptions/http-exception';
import UnprocessableException from '../core/exceptions/validation';

import { schema, bulkCreateSchema, bulkDeleteSchema, updateSchema } from '../schema/bankAgencies';
import BadRequestException from '../core/exceptions/bad-requests';

const key = 'banks_agencies';

//-----------------------------------------------------------------------------
//             CREATE BANKAGENCY : post /banks_Agencies
//-----------------------------------------------------------------------------

// IBankRequest
interface IRequest {
    name: string;
    town?: string;
    code:string;
    account_number?: string;
    bankId?:string;
}


// Handling create bankAgency process
export const create =
    async (req: Request, res: Response, next: NextFunction) => {
        // Validate input
        const parsed = schema.parse(req.body as IRequest);
        // search if the name already exists
        const isAlready = await prismaClient.bankAgency.findFirst({ where: { name: parsed.name } });
        if (isAlready) {
            throw new UnprocessableException(null, "Duplicate setting name", ErrorCode.RESSOURCE_ALREADY_EXISTS);
        }
        const data = await prismaClient.bankAgency.create({
            data: parsed,
        });
        revalidateService(key);

        res.status(201).json({
            success: true,
            data
        });
    };


//-----------------------------------------------------------------------------
//             GET ALL BANKAGENCY :  get /banks_Agencies
//-----------------------------------------------------------------------------

// Handling the process GET bankAgencies 
export const get =
    async (req: Request, res: Response, next: NextFunction) => {
        let data;
        const redis_data = await redis.get(key);
        if (redis_data) {
            data = JSON.parse(redis_data);
        } else {
            data = await revalidateService(key);
        }

        res.status(200).json({
            success: true,
            data
        });
    }


//-----------------------------------------------------------------------------
//             GET BANKAGENCY BY ID : get /banks_Agencies/:id
//-----------------------------------------------------------------------------

// Handling the process GET bankAgency by ID 
export const getById =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

        const data = await prismaClient.bankAgency.findUnique({
            where: { id: id },
            select: { bank: true }
        });
        if (!data) throw new NotFoundException("Bank not found", ErrorCode.RESSOURCE_NOT_FOUND);

        res.status(200).json({
            success: true,
            data
        });

    };

//-----------------------------------------------------------------------------
//             UPDATE BANKAGENCY : put  /banks_Agencies/:id
//-----------------------------------------------------------------------------

// Handling Update bankAgency process
export const update =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

        const parsed = updateSchema.parse(req.body); // Validate input
        const data = await prismaClient.bankAgency.update({
            where: { id: id },
            data: parsed,
        });
        revalidateService(key);

        res.status(200).json({
            success: true,
            data
        });

    };


//-----------------------------------------------------------------------------
//             DELETE BANKAGENCY : delete  /banks/:id
//-----------------------------------------------------------------------------

// Handling delete bankAgency process
export const remove =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);
        
        await prismaClient.bankAgency.delete({
            where: { id: id },
        });
        revalidateService(key);

        res.status(204).send(); // No content

    };


//-----------------------------------------------------------------------------
//             BULK-CREATE BANKAGENCY : post /banks
//-----------------------------------------------------------------------------

// IBulkCreateRequest interface definition
interface IBulkCreateRequest {
    data: { name: string }[];
}

// Handling create bankAgency process
export const bulkCreate = async (req: Request, res: Response, next: NextFunction) => {

    // Validate input
    const parsedData = bulkCreateSchema.parse(req.body as IBulkCreateRequest);

    // Check for duplicate bankAgency names
    const existingRessources = await Promise.all(parsedData.data.map(async item => {
        return await prismaClient.bankAgency.findFirst({ where: { name: item.name } });
    }));

    const duplicates = existingRessources.filter(item => item);
    if (duplicates.length > 0) {
        return res.status(422).json({
            success: false,
            message: "Duplicate setting names found",
            duplicates: duplicates.map(item => item?.name)
        });
    }

    // Create banks
    const createdBanks = await Promise.all(parsedData.data.map(bankAgency =>
        prismaClient.bankAgency.create({ data: bankAgency })
    ));

    revalidateService(key);

    res.status(201).json({
        success: true,
        data: createdBanks
    });

};

//-----------------------------------------------------------------------------
//             BULK-DELETE BANKAGENCY : delete  /banks/:id
//-----------------------------------------------------------------------------

// IBulkCreateRequest
interface IBulkDeleteRequest {
    data: { id: string }[];
}

// Handling bulk delete bankAgency process
export const bulkRemove = async (req: Request, res: Response, next: NextFunction) => {

    // Validate input using Zod
    const { ids } = bulkDeleteSchema.parse(req.body);

    // Perform bulk delete
    const deleteResult = await prismaClient.bankAgency.deleteMany({
        where: {
            id: { in: ids } // Use 'in' to delete all matching IDs in one query
        }
    });

    revalidateService(key);

    // Send response
    res.status(204).send(); // No content

};

const revalidateService = async (key: string) => {
    const data = await prismaClient.bankAgency.findMany({
        orderBy: {
            name: 'asc',
        },
    });
    await redis.set(key, JSON.stringify(data));
    return data
}