import { Router } from "express";

import authRoutes from "./auth";
import userRoutes from "./user";
import auditRoutes from "./audit";
import roleRoutes from "./role";
import bankRoutes from "./bank";
import permissionRoutes from "./permission";
import paymentModeRoutes from "./paymentMode";
import interncreditRoutes from "./interncredit";
import unpaidRoutes from "./unpaid";
import transactionRoutes from "./transaction";
import transactionDetailRoutes from "./transaction-detail";
import summaryRoutes from "./summary";
import notificationRoutes from "./notification";
import statusRoutes from "./status";
import unpaidOrPaidRoutes from "./unpaidOrPaid";
import customersReferenceRoutes from "./customerReference";
import segmentRoutes from "./segment";
import unitRoutes from "./unit";
import regionRoutes from "./region";
import bankAgencyRoutes from "./bankAgency";
import ticketRoutes from "../modules/tickets/routes/tickets";
import mmsRoutes from "./mms";
import workflowRoute from "../modules/workflows/routes/workflow";
import jobRouter from "../modules/jobs/job.route";

// Create an instance of the Router
const rootRouter:Router = Router();

// Define the main routes, associating them with their respective handlers

rootRouter.use('/auth' , authRoutes);                // Routes for authentication
rootRouter.use('/audits' , auditRoutes);             // Routes for audit management
rootRouter.use('/users' , userRoutes);               // Routes for user management
rootRouter.use('/roles' , roleRoutes);               // Routes for role management
rootRouter.use('/permissions' , permissionRoutes);   // Routes for permission management
rootRouter.use('/status' , statusRoutes);            // Routes for status management
rootRouter.use('/workflows' , workflowRoute);            // Routes for workflow management
rootRouter.use('/jobs' , jobRouter);            
 
rootRouter.use('/mms' , mmsRoutes);                  // Routes for Meter monitoring management

rootRouter.use('/summary' , summaryRoutes);           // Routes for summary management
rootRouter.use('/banks' , bankRoutes);                // Routes for bank management
rootRouter.use('/bank-agencies' , bankAgencyRoutes);  // Routes for branch management (bank agency management)
rootRouter.use('/pay-modes' , paymentModeRoutes);     // Routes for payment mode management
rootRouter.use('/segments' , segmentRoutes);          // Routes for segment management
rootRouter.use('/units' , unitRoutes);                 // Routes for unit management
rootRouter.use('/regions' , regionRoutes);             // Routes for region management
rootRouter.use('/requests' , transactionRoutes);       // Routes for transaction management
rootRouter.use('/requests-details' , transactionDetailRoutes);    // Routes for transaction detail management
rootRouter.use('/assignments' , ticketRoutes);    // Routes for assignment request management
rootRouter.use('/search-unpaid' , unpaidRoutes);                  // Routes for searching unpaid transactions
rootRouter.use('/search-paid-or-unpaid' , unpaidOrPaidRoutes);    // Routes for searching paid or unpaid transactions
rootRouter.use('/icn' , interncreditRoutes);                 // Routes for internal credit management
rootRouter.use('/notifications' , notificationRoutes);       // Routes for notification management
rootRouter.use('/customers-reference' , customersReferenceRoutes);   // Routes for customer reference management

// Export the root router for use in other parts of the application
export default rootRouter;