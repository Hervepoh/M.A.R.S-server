import { NextFunction, Request, Response } from "express";

import prismaClient from "../core/utils/prismadb";
import UnauthorizedException from "../core/exceptions/unauthorized";
import { ErrorCode } from "../core/exceptions/http-exception";

export const getLock =
    async (req: Request, res: Response, next: NextFunction) => {
        const result = await prismaClient.transactionTempUser.findMany(
            {
                select: {
                    transactionId: true, // Include transactionId
                    userId: true,        // Include userId
                    users: {
                        select: {
                            name: true, // Select only the name of the user
                        },
                    },
                },
            }
        );

        return res.status(200).json({
            success: true,
            data: result,
        });
    }


export const addLock =
    async (req: Request, res: Response, next: NextFunction) => {
        const user = await prismaClient.user.findFirst({
            where: { id: req.user?.id },
        });
        if (!user) throw new UnauthorizedException("Unauthorize ressource", ErrorCode.UNAUTHORIZED);

        const { transactionId } = req.body;

        const transaction = await prismaClient.transactionTempUser.findFirst({
            where: { transactionId }
        });
        let message = "already Lock";
        if (!transaction) {
            message = "Lock"
            await prismaClient.transactionTempUser.create({ data: { userId: user.id, transactionId } });
        }

        return res.status(200).json({
            success: true,
            message
        });
    }


export const removeLock =
    async (req: Request, res: Response, next: NextFunction) => {
        const user = await prismaClient.user.findFirst({
            where: { id: req.user?.id },
        });
        if (!user) throw new UnauthorizedException("Unauthorize ressource", ErrorCode.UNAUTHORIZED);

        const { transactionId } = req.body;

        const result = await prismaClient.transactionTempUser.findFirst({
            where: { userId: user.id, transactionId }
        });
        if (result) {
            await prismaClient.transactionTempUser.deleteMany({ where: { userId: user.id, transactionId } });
        }

        return res.status(200).json({
            success: true,
            message: "OK"
        });
    }
