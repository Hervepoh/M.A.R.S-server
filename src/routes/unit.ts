import { Router } from "express";

import { serviceType } from "../constants/enum";
import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";
import { create, get, getById, update , remove, bulkCreate, bulkRemove  } from "../controllers/unit";

const serviceName = serviceType.UNIT;
const unitRoutes:Router = Router();

unitRoutes.post('/', [authMiddleware,authorizeMiddleware(`${serviceName}-CREATE`)] , errorHandler(create));
unitRoutes.get('/', [authMiddleware,authorizeMiddleware(`${serviceName}-READ`)] ,errorHandler(get));
unitRoutes.get('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-READ`)] , errorHandler(getById));
unitRoutes.put('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-UPDATE`)], errorHandler(update));
unitRoutes.delete('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-DELETE`)] , errorHandler(remove));

unitRoutes.post('/bulk',[authMiddleware,authorizeMiddleware(`${serviceName}-BULKCREATE`)] , errorHandler(bulkCreate));
unitRoutes.delete('/bulk', [authMiddleware,authorizeMiddleware(`${serviceName}-BULKDELETE`)], errorHandler(bulkRemove));

export default unitRoutes;