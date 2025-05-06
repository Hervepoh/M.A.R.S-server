import { Router } from "express";

import { serviceType } from "../constants/enum";
import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";

import { disconnectMeter, reconnectMeter } from "../modules/mms/controllers/execute_job";
import { fetchResultValues } from "../modules/mms/controllers/getResultValues";
import { connect } from "../modules/mms/controllers/connect";


const serviceName = serviceType.MMS;
const mmsRoutes:Router = Router();

mmsRoutes.post('/connect', [authMiddleware] , errorHandler(connect));
mmsRoutes.post('/job/disconnect', [authMiddleware] , errorHandler(disconnectMeter));
mmsRoutes.post('/job/reconnect', [authMiddleware] , errorHandler(reconnectMeter));
mmsRoutes.post('/job/getstatus', [authMiddleware] , errorHandler(fetchResultValues));
// mmsRoutes.post('/connect', [authMiddleware,authorizeMiddleware(`${serviceName}-CREATE`)] , errorHandler(create));
// mmsRoutes.get('/', [authMiddleware] ,errorHandler(get));
// mmsRoutes.get('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-READ`)] , errorHandler(getById));
// mmsRoutes.put('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-UPDATE`)], errorHandler(update));
// mmsRoutes.delete('/:id', [authMiddleware,authorizeMiddleware(`${serviceName}-DELETE`)] , errorHandler(remove));

// mmsRoutes.post('/bulk',[authMiddleware,authorizeMiddleware(`${serviceName}-BULKCREATE`)] , errorHandler(bulkCreate));
// mmsRoutes.delete('/bulk', [authMiddleware,authorizeMiddleware(`${serviceName}-BULKDELETE`)], errorHandler(bulkRemove));

export default mmsRoutes;