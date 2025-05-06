import { NextFunction, Request, Response } from 'express';

import { redis } from '../core/utils/redis';
import prismaClient from '../core/utils/prismadb';
import NotFoundException from '../core/exceptions/not-found';
import { ErrorCode } from '../core/exceptions/http-exception';
import UnprocessableException from '../core/exceptions/validation';
import BadRequestException from '../core/exceptions/bad-requests';

const key = 'status';

//-----------------------------------------------------------------------------
//             GET ALL STATUS :  get /status
//-----------------------------------------------------------------------------

// Handling the process GET banks 
export const get =
    async (req: Request, res: Response, next: NextFunction) => {
        const { name, id } = req.query ;
        let data;
        if (id) {
            data = await getByIdService(parseInt(id.toString()))
            return res.status(200).json({
                success: true,
                data
            });
        }
        if (name) {
            data = await getByNameService(name.toString())

            return res.status(200).json({
                success: true,
                data
            });
        }

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
//             GET status BY ID : get /bank/:id
//-----------------------------------------------------------------------------

// Handling the process GET status by ID 
export const getById =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

        const data = getByIdService(parseInt(id))


        res.status(200).json({
            success: true,
            data
        });

    };


//-----------------------------------------------------------------------------
//             GET status BY name : get /bank
//-----------------------------------------------------------------------------

// Handling the process GET status by ID 
export const getByName =
    async (req: Request, res: Response, next: NextFunction) => {

        const { name } = req.body;
        if (!name) throw new BadRequestException('Invalid params ', ErrorCode.INVALID_DATA);

        const data = getByNameService(name)

        res.status(200).json({
            success: true,
            data
        });

    };


//-----------------------------------------------------------------------------
//             UPDATE status : put  /banks/:id
//-----------------------------------------------------------------------------

// Handling Update status process
export const update =
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA);

        const { name } = req.body;
        const data = await prismaClient.status.update({
            where: { id: parseInt(id) },
            data: { name },
        });
        revalidateService(key);

        res.status(200).json({
            success: true,
            data
        });

    };



const revalidateService = async (key: string) => {
    const data = await prismaClient.status.findMany({
        orderBy: {
            createdAt: 'desc',
        },
    });
    await redis.set(key, JSON.stringify(data));
    return data
}

const getByIdService = async (id: number) => {
    const data = await prismaClient.status.findUnique({
        where: { id: id },
    });
    if (!data) throw new NotFoundException("status not found", ErrorCode.RESSOURCE_NOT_FOUND);
    return data
}

const getByNameService = async (name: string) => {
    const data = await prismaClient.status.findFirst({
        where: { name: name },
    });
    if (!data) throw new NotFoundException("status not found", ErrorCode.RESSOURCE_NOT_FOUND);
    return data
}