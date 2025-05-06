import { Router } from "express";

import { serviceType } from "../constants/enum";
import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";
import {
    getICNNextCode,
    getICNDematerializeCode,
    getICNGroupes,
    getICN,
    generationOfIntegrationFile,
    update_document_entry_status,
    close_transaction_all_document_entry_status_integrated,
    transaction_brouillard_generation,
} from "../controllers/icn";

const serviceName = serviceType.ICN;
const interncreditRoutes: Router = Router();

interncreditRoutes.get(
    "/next-code",
    [
        authMiddleware,
        authorizeMiddleware(
            `${serviceName}-READ`,
            `${serviceName}-NEXTCODE`
        ),
    ],
    errorHandler(getICNNextCode)
);

interncreditRoutes.get(
    "/next-dematerialization",
    [
        authMiddleware,
        authorizeMiddleware(
            `${serviceName}-READ`,
            `${serviceName}-NEXTDEMATERIALIZATION`
        ),
    ],
    errorHandler(getICNDematerializeCode)
);

interncreditRoutes.get(
    "/groupes",
    [
        authMiddleware,
        authorizeMiddleware(
            `${serviceName}-READ`,
            `${serviceName}-GROUPES`
        ),
    ],
    errorHandler(getICNGroupes)
);

interncreditRoutes.get(
    "/",
    [
        authMiddleware,
        authorizeMiddleware(`${serviceName}-READ`)
    ],
    errorHandler(getICN)
);

interncreditRoutes.get(
    "/documents",
    [
        authMiddleware,
        authorizeMiddleware(
            `${serviceName}-READ`,
            `${serviceName}-DOCUMENTS`
        ),
    ],
    errorHandler(generationOfIntegrationFile)
);


interncreditRoutes.get(
    "/brouillard/:reference",
    errorHandler(transaction_brouillard_generation)
);


interncreditRoutes.get(
    "/test",
    errorHandler(update_document_entry_status)
);

export default interncreditRoutes;
