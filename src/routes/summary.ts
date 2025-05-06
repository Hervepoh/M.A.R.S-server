import { Router } from "express";

import { serviceType } from "../constants/enum";
import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";
import { summary } from "../controllers/summary";

const serviceName = serviceType.SUMMARY;
const summaryRoutes:Router = Router();

summaryRoutes.get('/', [authMiddleware,authorizeMiddleware(`${serviceName}-READ`,`${serviceName}-README`)] , summary);

export default summaryRoutes;