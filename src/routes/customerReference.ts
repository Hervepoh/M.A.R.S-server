import { Router } from "express";

import { serviceType } from "../constants/enum";
import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";
import { create, getById, update, remove, bulkCreate, bulkRemove } from "../controllers/customerReference";
import { get, getByContractNumber } from "../modules/cms/controllers/customer";
import { get as getPayments } from "../modules/cms/controllers/payment";
import { get as getMetersReading } from "../modules/mms/controllers/reading";

const serviceName = serviceType.CUSTOMERSREFERENCES;
const customersReferenceRoutes: Router = Router();

customersReferenceRoutes.post('/', [authMiddleware, authorizeMiddleware(`${serviceName}-CREATE`)], errorHandler(create));
customersReferenceRoutes.get('/', [authMiddleware], errorHandler(get));
customersReferenceRoutes.get('/payments', [authMiddleware], errorHandler(getPayments));
customersReferenceRoutes.get('/meters/reading', [authMiddleware], errorHandler(getMetersReading));
customersReferenceRoutes.get('/contracts/:id', [authMiddleware], errorHandler(getByContractNumber));
//customersReferenceRoutes.get('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-READ`)] , errorHandler(getById));
customersReferenceRoutes.put('/:id', [authMiddleware, authorizeMiddleware(`${serviceName}-UPDATE`)], errorHandler(update));
customersReferenceRoutes.delete('/:id', [authMiddleware, authorizeMiddleware(`${serviceName}-DELETE`)], errorHandler(remove));

customersReferenceRoutes.post('/bulk', [authMiddleware, authorizeMiddleware(`${serviceName}-BULKCREATE`)], errorHandler(bulkCreate));
customersReferenceRoutes.delete('/bulk', [authMiddleware, authorizeMiddleware(`${serviceName}-BULKDELETE`)], errorHandler(bulkRemove));

export default customersReferenceRoutes;