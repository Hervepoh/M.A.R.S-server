import { NextFunction, Request, Response } from 'express';

import { redis } from '../core/utils/redis';
import prismaClient from '../core/utils/prismadb';
import { ErrorCode } from '../core/exceptions/http-exception';
import NotFoundException from '../core/exceptions/not-found';
import UnprocessableException from '../core/exceptions/validation';

import { schema, bulkCreateSchema, bulkDeleteSchema } from '../schema/segments';
import BadRequestException from '../core/exceptions/bad-requests';

const key = 'segments';

//-----------------------------------------------------------------------------
//             CREATE : post /segments
//-----------------------------------------------------------------------------
interface IRequest {
    name: string;
}

// Handling create segment process
export const create =
    async (req: Request, res: Response, next: NextFunction) => {
        // Validate input
        const parsed = schema.parse(req.body as IRequest);

        const isAlready = await prismaClient.segment.findFirst({ where: { name: parsed.name } });
        if (isAlready) {
            throw new UnprocessableException(null, "Duplicate name", ErrorCode.RESSOURCE_ALREADY_EXISTS);
        }

        const data = await prismaClient.segment.create({
            data: parsed,
        });

        revalidateService(key);

        res.status(201).json({
            success: true,
            data
        });
    };


//-----------------------------------------------------------------------------
//             GET ALL :  get /segments
//-----------------------------------------------------------------------------

// Handling the process GET segments 
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
//             GET BY ID : get /segments/:id
//-----------------------------------------------------------------------------

// Handling the process GET segment by ID 
export const getById =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

        const data = await prismaClient.segment.findUnique({
            where: { id: id },
        });
        if (!data) throw new NotFoundException("Item not found", ErrorCode.RESSOURCE_NOT_FOUND);

        res.status(200).json({
            success: true,
            data
        });

    };

//-----------------------------------------------------------------------------
//             UPDATE : put  /segments/:id
//-----------------------------------------------------------------------------

// Handling Update segment process
export const update =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

        const parsed = schema.parse(req.body); // Validate input

        const data = await prismaClient.segment.update({
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
//             DELETE : delete  /segments/:id
//-----------------------------------------------------------------------------

// Handling delete segment process
export const remove =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

        await prismaClient.segment.delete({
            where: { id: id },
        });

        revalidateService(key);

        res.status(204).send(); // No content

    };


//-----------------------------------------------------------------------------
//             BULK-CREATE : post /segments
//-----------------------------------------------------------------------------

// IBulkCreateRequest interface definition
interface IBulkCreateRequest {
    data: { name: string }[];
}

// Handling create segment process
export const bulkCreate = async (req: Request, res: Response, next: NextFunction) => {

    // Validate input
    const parsedData = bulkCreateSchema.parse(req.body as IBulkCreateRequest);

    // Check for duplicate segment names
    const existingRessources = await Promise.all(parsedData.data.map(async item => {
        return await prismaClient.segment.findFirst({ where: { name: item.name } });
    }));

    const duplicates = existingRessources.filter(item => item);
    if (duplicates.length > 0) {
        return res.status(422).json({
            success: false,
            message: "Duplicate name found",
            duplicates: duplicates.map(item => item?.name)
        });
    }

    // Create segments
    const createdPaymentModes = await Promise.all(parsedData.data.map(segment =>
        prismaClient.segment.create({ data: segment })
    ));

    revalidateService(key);

    res.status(201).json({
        success: true,
        data: createdPaymentModes
    });

};

//-----------------------------------------------------------------------------
//             BULK-DELETE : delete  /segments/:id
//-----------------------------------------------------------------------------

// IBulkCreateRequest
interface IBulkDeleteRequest {
    data: { id: string }[];
}

// Handling bulk delete segment process
export const bulkRemove = async (req: Request, res: Response, next: NextFunction) => {

    // Validate input using Zod
    const { ids } = bulkDeleteSchema.parse(req.body);

    // Perform bulk delete
    const deleteResult = await prismaClient.segment.deleteMany({
        where: {
            id: { in: ids } // Use 'in' to delete all matching IDs in one query
        }
    });

    revalidateService(key);

    // Send response
    res.status(204).send(); // No content

};

const revalidateService = async (key: string) => {

    const data = await prismaClient.segment.findMany({
        orderBy: {
            createdAt: 'desc',
        },
    });
    
    await redis.set(key, JSON.stringify(data));
    
    return data
}