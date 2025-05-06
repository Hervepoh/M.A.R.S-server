import { NextFunction, Request, Response } from "express";
import axios from "axios";
import { parseStringPromise } from 'xml2js'; // Import de xml2js pour parser la réponse XML
import { SourceType } from "@prisma/client";

import prismaClient from "../../../core/utils/prismadb";

import HttpException, { ErrorCode } from "../../../core/exceptions/http-exception";
import { getUserConnected } from "../../../core/utils/authentificationService";
import UnauthorizedException from "../../../core/exceptions/unauthorized";
import { logger } from "../../../core/utils/logger";

import { MMS_DBPROFILE, MMS_PASSWORD, MMS_USER, MMS_WSDL_URL } from "../../../secrets";
import { createAuditLog } from "../../../core/utils/audit";
import ConfigurationException from "../../../core/exceptions/configuration";
import { EventType } from "../../../constants/enum";

/**
 * Appelle le service SOAP pour se connecter.
 */
const callSoapService = async (): Promise<string> => {
    const soapRequest = `
        <soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:simgr">
            <soapenv:Header/>
            <soapenv:Body>
                <urn:Connect soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
                    <strUser xsi:type="xsd:string">${MMS_USER}</strUser>
                    <strPwd xsi:type="xsd:string">${MMS_PASSWORD}</strPwd>
                    <strDBProfile xsi:type="xsd:string">${MMS_DBPROFILE}</strDBProfile>
                </urn:Connect>
            </soapenv:Body>
        </soapenv:Envelope>
    `;

    const config = {
        method: 'post',
        url: MMS_WSDL_URL!,
        headers: { 'Content-Type': 'application/xml' },
        data: soapRequest,
    };

    try {
        const response = await axios.request(config);
        return response.data;
    } catch (error) {
        logger.error("[MMS CONNECT] SOAP Service connect error:", error);
        throw new HttpException("SOAP Service Error", 500, ErrorCode.INVALID_DATA, error);
    }
};

/**
 * Parse la réponse SOAP et extrait la valeur de <Result>.
 */
const parseSoapResponse = async (xmlData: string): Promise<string> => {
    try {
        const result = await parseStringPromise(xmlData, { explicitArray: false });
        const resultValue = result['SOAP-ENV:Envelope']['SOAP-ENV:Body']['simgr:ConnectResponse'].Result;

        if (!resultValue) {
            throw new Error("No <Result> found in SOAP response");
        }

        return resultValue["_"]; // Renvoie la valeur extraite
    } catch (error) {
        logger.error("[MMS CONNECT] XML Parsing Error:", error);
        throw new HttpException("Failed to parse SOAP response", 500, ErrorCode.INVALID_DATA, error);
    }
};

//-----------------------------------------------------------------------------
//               Contrôleurs
//-----------------------------------------------------------------------------

/**
 * Gère la connexion utilisateur via MMS.
 */
export const connect = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Récupération de l'utilisateur connecté
        const user = await getUserConnected(req);
        if (!user) {
            throw new UnauthorizedException("Unauthorized resource", ErrorCode.UNAUTHORIZED);
        }

        // Appel au service SOAP pour valider les informations de connexion
        const soapResponse = await callSoapService();

        // Extraction de la valeur <Result> de la réponse SOAP
        const resultValue = await parseSoapResponse(soapResponse);

        // Réponse en cas de succès
        res.status(200).json({
            success: true,
            message: "Login successful",
            result: resultValue,
        });

        // Création de l'audit
        await createAuditLog(
            user.id,
            req.ip || 'unknown',
            EventType.LOGIN,
            `[MMS CONNECT] User : ${user.email} has logged in`,
            '/mms/connect',
            SourceType.USER
        );

    } catch (error) {
        logger.error("[MMS CONNECT] Something went wrong:", error);
        next(error);
    }
};

/**
 * Gère la connexion interne via MMS.
 */
export const internalConnect = async () => {
    try {
        // Appel au service SOAP pour valider les informations de connexion
        const soapResponse = await callSoapService();

        // Extraction de la valeur <Result> de la réponse SOAP
        const resultValue = await parseSoapResponse(soapResponse);

        // System account TODO update the user
        const user = await prismaClient.user.findFirst({
            where: { email: "admin@eneo.cm" }
        })
        if (!user) throw new ConfigurationException("BAD CONFIG NEED TO CREATE THE SYSTEM ACCOUNT", ErrorCode.UNAUTHORIZED);

        // Création de l'audit
        await createAuditLog(
            user.id,
            'unknown',
            EventType.LOGIN,
            `[MMS CONNECT] internal connection in`,
            '/mms/internalconnect',
            SourceType.SYSTEM
        );

        // Renvoie la valeur extraite
        return resultValue;

    } catch (error) {
        logger.error("[MMS CONNECT] Something went wrong in internalConnect:", error);
        throw error; // Propager l'erreur pour une gestion ultérieure
    }
};




