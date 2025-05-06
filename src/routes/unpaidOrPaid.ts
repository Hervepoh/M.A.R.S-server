import { Router } from "express";

import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";
import { serviceType } from "../constants/enum";
import { getBills } from "../controllers/unpaidOrPaid";

const serviceName = serviceType.UNPAID;
const unpaidOrPaidRoutes:Router = Router();

unpaidOrPaidRoutes.get('/', [authMiddleware,authorizeMiddleware(`${serviceName}-SEARCH`)] , errorHandler(getBills));

export default unpaidOrPaidRoutes;