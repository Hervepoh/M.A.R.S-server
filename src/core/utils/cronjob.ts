import { logger } from "./logger";
import prismaClient from "./prismadb";


export const run_job = async (job_name: string, job: Function) => {
  try {
    const lock = await prismaClient.jobLock.findUnique({ where: { job_name } });

    // Ensure the lock entry exists
    if (!lock) {
      const init = await prismaClient.jobLock.upsert({
        where: { job_name },
        update: {},
        create: { job_name, is_running: false }
      });
      logger.info(`JOB : ${job_name} first initialisation`);
      return
    }

    // Check if the job is already running
    if (lock.is_running) {
      logger.info(`JOB : ${job_name} is already running. Exiting...`);
      return; // Exit if another instance is running
    }

    // Set the lock to true
    await prismaClient.jobLock.update({
      where: { job_name },
      data: { is_running: true }
    });

    job();

  } catch (error) {
    logger.error("Fail to generate document", error);
  } finally {
    //TODO remove this 
    // // Sleep function
    //const sleep = (ms: any) => new Promise(resolve => setTimeout(resolve, ms));
    // // Sleep for 5 minutes (300,000 milliseconds)
    // await sleep(100000); // 5 minutes

    // Release the lock
    await prismaClient.jobLock.update({
      where: { job_name },
      data: { is_running: false }
    });
  }
}


