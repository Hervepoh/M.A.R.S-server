import { Router } from "express";

import { serviceType } from "../constants/enum";
import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";
import { create, get, getById, update , remove, bulkCreate, bulkRemove  } from "../controllers/segment";

const serviceName = serviceType.SEGMENT;
const segmentRoutes:Router = Router();

segmentRoutes.post('/', [authMiddleware,authorizeMiddleware(`${serviceName}-CREATE`)] , errorHandler(create));
segmentRoutes.get('/', [authMiddleware,authorizeMiddleware(`${serviceName}-READ`)] ,errorHandler(get));
segmentRoutes.get('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-READ`)] , errorHandler(getById));
segmentRoutes.put('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-UPDATE`)], errorHandler(update));
segmentRoutes.delete('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-DELETE`)] , errorHandler(remove));

segmentRoutes.post('/bulk',[authMiddleware,authorizeMiddleware(`${serviceName}-BULKCREATE`)] , errorHandler(bulkCreate));
segmentRoutes.delete('/bulk', [authMiddleware,authorizeMiddleware(`${serviceName}-BULKDELETE`)], errorHandler(bulkRemove));

export default segmentRoutes;