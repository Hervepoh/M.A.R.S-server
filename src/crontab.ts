import { NextFunction, Request, Response } from "express";
import cron from "node-cron";
import { run_job } from "./core/utils/cronjob";
import { attachTicketToWorkflow } from "./modules/workflows/services/workflow-ticket-service";
import { enqueueTicketJob } from "./modules/jobs/producer";


//-----------------------------------------------
//  Job qui attache un ticket à un workflow
//-----------------------------------------------
cron.schedule('* * * * *', async () => await run_job("ticket_workflow", attachTicketToWorkflow));

//-----------------------------------------------
//  Job Producteur  qui recupérer tous les tickets approuve et générer le job de coupure/remise
//-----------------------------------------------
cron.schedule('* * * * *', async () => await run_job("ticket_producer", enqueueTicketJob));

//-----------------------------------------------
//  Job Consommateur  qui execute les JOB :la coupure remise 
//-----------------------------------------------
cron.schedule('* * * * *', async () => await run_job("ticket_consumer", attachTicketToWorkflow));