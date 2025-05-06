import { NextFunction, Request, Response } from "express";
import prismaClient from "./prismadb";
import UnauthorizedException from "../exceptions/unauthorized";
import { ErrorCode } from "../exceptions/http-exception";
import { Client } from 'ldapts';
import BadRequestException from "../exceptions/bad-requests";
import NotFoundException from "../exceptions/not-found";
import { LogLevel, LogType, writeLogEntry } from "./log";

export const getUserConnected = async (req: Request) => {
    const userId = req.user?.id;

    if (!userId) {
        throw new UnauthorizedException("Unauthorized resource", ErrorCode.UNAUTHORIZED);
    }

    const user = await prismaClient.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new UnauthorizedException("Unauthorized resource", ErrorCode.UNAUTHORIZED);
    }

    return {...user, role: req.user?.role};
};


// handling LDAP connection
export const ldapLogin = async (userId: string, password: string) => {
    const client = new Client({
        url: 'ldap://10.250.90.8:389',
    });

    try {
        await client.bind(`${userId}@camlight.cm`, password);
        return true;
    } catch (error) {
        writeLogEntry(`${userId}@camlight.cm`, LogLevel.INFO, LogType.AUTHENTICATION);
        throw new BadRequestException("Invalid Email or Password", ErrorCode.INVALID_DATA);
    }finally {
        // Assurez-vous de vous défaire de la liaison
        await client.unbind();
    }
};
