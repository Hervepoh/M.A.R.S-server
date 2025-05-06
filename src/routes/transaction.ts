import { Router } from "express";

import { serviceType } from "../constants/enum";
import { errorHandler } from "../core/error-handler";
import authMiddleware, { authorizeMiddleware } from "../middlewares/auth";
import {
  create,
  get,
  getById,
  update,
  remove,
  softRemove,
  bulkCreate,
  bulkSoftRemove,
  qualityAssurance,
  unicityAssurance,
  unicityAssuranceById,
  getAwaitingAssignationWithPaginationAndComplexeFilterFeatureOptimizeForPrisma,
  getWithPaginationAndComplexeFilterFeatureOptimizeForPrisma,
  getAwaitingKamInputEligibleForUnassignmentWithPaginationAndComplexeFilterFeatureOptimizeForPrisma,
  unassignment,
} from "../controllers/transaction";
import { addLock, getLock, removeLock } from "../controllers/transactions-lock";
import { exportData } from "../controllers/transaction-export";

const serviceName = serviceType.TRANSACTION;
const transactionRoutes: Router = Router();

transactionRoutes.post(
  "/",
  [
    authMiddleware,
    authorizeMiddleware(`${serviceName}-CREATE`, `${serviceName}-WRITE`),
  ],
  errorHandler(create)
);
transactionRoutes.get(
  "/",
  [authMiddleware, authorizeMiddleware(`${serviceName}-READ`)],
  errorHandler(get)
);
transactionRoutes.get(
  "/all",
  [authMiddleware, authorizeMiddleware(`${serviceName}-READ`)],
  errorHandler(getWithPaginationAndComplexeFilterFeatureOptimizeForPrisma)
);
transactionRoutes.get(
  "/assignments",
  [authMiddleware, authorizeMiddleware(`${serviceName}-READ`)],
  errorHandler(
    getAwaitingAssignationWithPaginationAndComplexeFilterFeatureOptimizeForPrisma
  )
);
transactionRoutes.get(
  "/unassignments",
  [authMiddleware, authorizeMiddleware(`${serviceName}-READ`)],
  errorHandler(
    getAwaitingKamInputEligibleForUnassignmentWithPaginationAndComplexeFilterFeatureOptimizeForPrisma
  )
);
transactionRoutes.get(
  "/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
  [authMiddleware, authorizeMiddleware(`${serviceName}-READ`)],
  errorHandler(getById)
);
transactionRoutes.put(
    "/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/unassignment",
    [
      authMiddleware,
      authorizeMiddleware(
        `${serviceName}-UPDATE`,
        `${serviceName}-VALIDATE`,
        `${serviceName}-ASSIGN`,
        `${serviceName}-WRITE`,
      ),
    ],
    errorHandler(unassignment)
  );
  
transactionRoutes.put(
  "/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
  [
    authMiddleware,
    authorizeMiddleware(
      `${serviceName}-UPDATE`,
      `${serviceName}-VALIDATE`,
      `${serviceName}-ASSIGN`,
      `${serviceName}-WRITE`,
    `${serviceName}-COMMERCIAL`
    ),
  ],
  errorHandler(update)
);

transactionRoutes.delete(
  "/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
  [
    authMiddleware,
    authorizeMiddleware(`${serviceName}-DELETE`, `${serviceName}-WRITE`),
  ],
  errorHandler(softRemove)
);
transactionRoutes.delete(
  "/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
  [authMiddleware, authorizeMiddleware(`${serviceName}-FULLDELETE`)],
  errorHandler(remove)
);

transactionRoutes.post(
  "/bulk",
  [authMiddleware, authorizeMiddleware(`${serviceName}-BULKCREATE`)],
  errorHandler(bulkCreate)
);
transactionRoutes.delete(
  "/bulk",
  [authMiddleware, authorizeMiddleware(`${serviceName}-BULKDELETE`)],
  errorHandler(bulkSoftRemove)
);

transactionRoutes.get(
  "/export/:id",
  [authMiddleware],
  errorHandler(exportData)
);
transactionRoutes.post(
  "/quality-assurance/:id",
  [authMiddleware],
  errorHandler(qualityAssurance)
);
transactionRoutes.post("/unicity-assurance", errorHandler(unicityAssurance));
transactionRoutes.post(
  "/unicity-assurance/:id",
  errorHandler(unicityAssuranceById)
);

transactionRoutes.get("/lock", errorHandler(getLock));
transactionRoutes.post("/lock", [authMiddleware], errorHandler(addLock));
transactionRoutes.delete("/lock", [authMiddleware], errorHandler(removeLock));

export default transactionRoutes;
