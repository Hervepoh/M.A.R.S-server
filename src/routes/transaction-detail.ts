import { Router } from "express";

import { serviceType } from "../constants/enum";
import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";
import { create, get, update , remove, bulkCreate, bulkUpdate  } from "../controllers/transaction-details";

const serviceName = serviceType.TRANSACTIONDETAIL;
const transactionDetailRoutes:Router = Router();

transactionDetailRoutes.post('/',  [authMiddleware,authorizeMiddleware(`${serviceName}-CREATE`,`${serviceName}-WRITE`)] , errorHandler(create));
transactionDetailRoutes.get('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-READ`)] ,errorHandler(get));
transactionDetailRoutes.put('/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', [authMiddleware,authorizeMiddleware(`${serviceName}-UPDATE`,`${serviceName}-WRITE`)], errorHandler(update));
transactionDetailRoutes.delete('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-DELETE`,`${serviceName}-WRITE`)] , errorHandler(remove));

transactionDetailRoutes.post('/bulk/:id',[authMiddleware,authorizeMiddleware(`${serviceName}-BULKCREATE`)] , errorHandler(bulkCreate));
transactionDetailRoutes.put('/bulk/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-BULKDELETE`)], errorHandler(bulkUpdate));


export default transactionDetailRoutes;