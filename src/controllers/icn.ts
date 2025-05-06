import { NextFunction, Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import cron from "node-cron";
import { Client } from 'ssh2';

import { sqlQuery } from "../constants/request";
import prismaClient from "../core/utils/prismadb";
import { executeQuery, getConnection, releaseConnection } from "../core/utils/db.oracle";
import BadRequestException from "../core/exceptions/bad-requests";
import { ErrorCode } from "../core/exceptions/http-exception";
import { LogLevel, LogType, writeLogEntry } from "../core/utils/log";
import { EventIntegrationType, NotificationMethod, IntegrationDocument } from "@prisma/client";
import InternalException from "../core/exceptions/internal-exception";
import { formatReference } from "../core/utils/formatter";
import { SCRIPT_GENERATION_BROUILLARD, SCRIPT_GENERATION_BROUILLARD_OUTPUT } from "../secrets";


//---------------------------------------------------------
//              GET ICN CODE 
//---------------------------------------------------------
export const getICNNextCode =
  async (req: Request, res: Response, next: NextFunction) => {

    // Fetch data from the database
    const result = await executeQuery(sqlQuery.icn_next_code);

    // send the response
    return res.status(200).json({
      success: true,
      icn_code: result.rows[0][0] ?? ""
    });

  };


//---------------------------------------------------------
//              GET ICN DEMATERIALIZE CODE 
//---------------------------------------------------------
export const getICNDematerializeCode =
  async (req: Request, res: Response, next: NextFunction) => {

    // Fetch data from the database
    const result = await executeQuery(sqlQuery.icn_next_dematerialisation_code);

    // send the response
    return res.status(200).json({
      success: true,
      dematerialisation: result.rows[0][0] ?? ""
    });

  };


//---------------------------------------------------------
//              GET GROUPES
//---------------------------------------------------------
export const getICNGroupes =
  async (req: Request, res: Response, next: NextFunction) => {

    // Fetch data from the database
    const result = await executeQuery(sqlQuery.select_groupes);

    // send the response
    return res.status(200).json({
      success: true,
      groupes: result.rows
    });

  };


//---------------------------------------------------------
//              GET GROUPES
//---------------------------------------------------------
export const getICN =
  async (req: Request, res: Response, next: NextFunction) => {

    const { id: icn_number, type } = req.body
    // TODO :  Define the contraint due to the period 
    if (!icn_number) {
      throw new BadRequestException("Invalid parameters", ErrorCode.INVALID_DATA);
    }

    let query = "";
    let value: string[] = [];
    switch (type) {
      case "full":
        query = sqlQuery.icn_fulldata
        value = [icn_number];
        break;
      case "light":
        query = sqlQuery.icn_lightdata
        value = [icn_number, icn_number, icn_number];
        break;
      default:
        query = sqlQuery.icn_infos;
        value = [icn_number];
        break;
    }
    const result = await executeQuery(query, value);

    // send the response
    return res.status(200).json({
      success: true,
      data: result.rows
    });


  };


//---------------------------------------------------------
//             GENERATE USING API
//---------------------------------------------------------
export const generationOfIntegrationFile =
  async (req: Request, res: Response, next: NextFunction) => {

    try {
      const filePath = generationIntegrationFile();
      // send the response
      return res.status(200).json({
        success: true,
        file: `CSV file generated at ${filePath}`
      });
    } catch (error) {
      throw new InternalException("Somethiing when wron", error, ErrorCode.INTERNAL_EXCEPTION)
    }
  };


//-----------------------------------------------
//        generationIntegrationFile
//-----------------------------------------------  
export const generationIntegrationFilePerReference = async () => {

  // writeLogEntry('JOB : generationIntegrationFile --> start', LogLevel.INFO, LogType.GENERAL);

  // Fetch data from the database
  const documents = await prismaClient.integrationDocument.findMany({
    where: { integration_status: EventIntegrationType.WAIT_GENERATION }
  });

  // Early exit if no documents found
  if (documents.length === 0) {
    //console.log("No documents with WAIT_GENERATION status");
    // writeLogEntry('JOB : generationIntegrationFile --> No documents with WAIT_GENERATION status found.', LogLevel.INFO, LogType.GENERAL);
    //writeLogEntry('JOB : generationIntegrationFile --> end', LogLevel.INFO, LogType.GENERAL);
    return null;
  }

  // Calculate total paid amount
  const totalPaidAmount = documents.reduce((sum, document) => sum + parseInt(document.paid_amount || '0', 10), 0);


  // Create CSV content
  const timestamp = moment().tz("Africa/Douala");
  let csvContent = `File Generated on=${timestamp.format('ddd MMM DD HH:mm:ss [WAT] YYYY')}\n` +
    `Data for Date=${timestamp.format('DD/MM/YYYY')}|5701473|${totalPaidAmount}|${documents.length}\n` +
    'Transaction_ID|Sub_transaction_Type|Bill_Partner_Company_name|Bill_partner_company_code|Bill_Number|Bill_Account_Number|Bill_Due_Date|Paid_Amount|Paid_Date|Paid_By_MSISDN|Transaction_Status|OM_Bill_Payment_Status\n';

  documents.forEach((doc) => {
    csvContent += `${doc.transaction_id}|${doc.sub_transaction_type}|${doc.bill_partner_company_name}|${doc.bill_partner_company_code}|${doc.bill_number}|${doc.bill_account_number}||${doc.paid_amount}|${doc.paid_date}|${doc.paid_by_msisdn}|${doc.transaction_status}|${doc.om_bill_payment_status}\n`;
  });

  // Generate file name and path
  const fileName = `AES_${timestamp.format('MMDDYYYYHHmmss')}_PAIDBILLS.csv`;
  const outputDir = path.join(__dirname, '../../output');
  const filePath = path.join(outputDir, fileName);

  // Create 'output' directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true }); // Using recursive option for safety
  }

  // Write the CSV file
  fs.writeFileSync(filePath, csvContent);

  // Update the status of each document to GENERATED
  const documentIds = documents.map(doc => doc.id); // Extract the IDs of the documents
  await prismaClient.integrationDocument.updateMany({
    where: { id: { in: documentIds } },
    data: { integration_status: EventIntegrationType.GENERATED }
  });

  writeLogEntry(`JOB : generationIntegrationFile --> updateMany ${documentIds.length} integrationDocument to GENERATED`, LogLevel.INFO, LogType.GENERAL, documentIds);
  // writeLogEntry('JOB : generationIntegrationFile --> end', LogLevel.INFO, LogType.GENERAL);

  return filePath;

}


export const generationIntegrationFile = async () => {
  // writeLogEntry('JOB : generationIntegrationFile --> start', LogLevel.INFO, LogType.GENERAL);

  // Fetch data from the database
  const documents = await prismaClient.integrationDocument.findMany({
    where: { integration_status: EventIntegrationType.WAIT_GENERATION }
  });

  // Early exit if no documents found
  if (documents.length === 0) {
    // writeLogEntry('JOB : generationIntegrationFile --> No documents with WAIT_GENERATION status found.', LogLevel.INFO, LogType.GENERAL);
    return null;
  }

  // Définir le type pour le groupe de documents
  type DocumentGroup = {
    [key: string]: IntegrationDocument[]; // Clé de type string, valeur tableau de Document
  };

  // Group documents by reference
  const groupedDocuments: DocumentGroup = documents.reduce((groups: any, document) => {
    const reference = document.reference; // Remplacez 'reference' par le nom de la propriété qui contient votre référence
    if (!groups[reference]) {
      groups[reference] = [];
    }
    groups[reference].push(document);
    return groups;
  }, {});

  // Generate CSV files for each reference group
  const filePaths = [];

  for (const reference of Object.keys(groupedDocuments)) {
    const timestamp = moment().tz("Africa/Douala");

    const docs = groupedDocuments[reference];
    const totalPaidAmount = docs.reduce((sum, doc) => sum + parseInt(doc.paid_amount || '0', 10), 0);

    // Create CSV content
    let csvContent = `File Generated on=${timestamp.format('ddd MMM DD HH:mm:ss [WAT] YYYY')}\n` +
      `Data for Date=${timestamp.format('DD/MM/YYYY')}|5701473|${totalPaidAmount}|${docs.length}\n` +
      'Transaction_ID|Sub_transaction_Type|Bill_Partner_Company_name|Bill_partner_company_code|Bill_Number|Bill_Account_Number|Bill_Due_Date|Paid_Amount|Paid_Date|Paid_By_MSISDN|Transaction_Status|OM_Bill_Payment_Status\n';

    docs.forEach((doc) => {
      csvContent += `${doc.transaction_id}|${doc.sub_transaction_type}|${doc.bill_partner_company_name}|${doc.bill_partner_company_code}|${doc.bill_number}|${doc.bill_account_number}||${doc.paid_amount}|${doc.paid_date}|${doc.paid_by_msisdn}|${doc.transaction_status}|${doc.om_bill_payment_status}\n`;
    });

    // Generate file name and path
    const fileName = `AES_${timestamp.format('MMDDYYYY_HHmmss')}_PAIDBILLS.csv`; // Inclure la référence dans le nom de fichier
    const outputDir = path.join(__dirname, '../../output');
    const filePath = path.join(outputDir, fileName);

    // Create 'output' directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true }); // Using recursive option for safety
    }

    // Write the CSV file
    fs.writeFileSync(filePath, csvContent);
    filePaths.push(filePath);

    // Attendre 1 seconde entre chaque génération de fichier
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Update the status of each document to GENERATED
  const documentIds = documents.map(doc => doc.id); // Extract the IDs of the documents
  await prismaClient.integrationDocument.updateMany({
    where: { id: { in: documentIds } },
    data: { integration_status: EventIntegrationType.GENERATED }
  });

  writeLogEntry(`JOB : generationIntegrationFile --> updateMany ${documentIds.length} integrationDocument to GENERATED`, LogLevel.INFO, LogType.GENERAL, documentIds);
  // writeLogEntry('JOB : generationIntegrationFile --> end', LogLevel.INFO, LogType.GENERAL);

  return filePaths; // Retourner les chemins des fichiers générés
}

//-----------------------------------------------
//        For each invoice, add payment document entry
//-----------------------------------------------  
export const add_document_entry = async () => {

  // writeLogEntry('JOB : add_document_entry --> start', LogLevel.INFO, LogType.GENERAL);
  try {
    const documents: any = await prismaClient.$queryRaw`
      SELECT td.*,t.reference
      FROM transaction_details td
      JOIN transactions t ON td.transactionId = t.id
      WHERE t.statusId = 8
        AND td.selected = 1
        AND td.id NOT IN (SELECT transactionDetailsId FROM integration_documents)
      ORDER BY t.reference ASC
    `;

    // If no documents found, exit early
    if (documents.length === 0) {
      // writeLogEntry('JOB : add_document_entry --> No documents to process.', LogLevel.INFO, LogType.GENERAL);
      // writeLogEntry('JOB : add_document_entry --> end', LogLevel.INFO, LogType.GENERAL);
      return;
    }

    // Batch check existing documents
    const existingIds = await prismaClient.integrationDocument.findMany({
      where: {
        transactionDetailsId: { in: documents.map((doc: any) => doc.id) }
      },
      select: { transactionDetailsId: true }
    }).then(existing => existing.map(doc => doc.transactionDetailsId));

    const timestamp = moment().tz("Africa/Douala");
    // Prepare data for creation
    const integrationDocuments = documents
      .filter((document: any) => !existingIds.includes(document.id))
      .map((document: any, index: any) => ({
        reference: document.reference,
        transactionId: document.transactionId,
        transactionDetailsId: document.id,
        transaction_id: `AC${formatReference(document.reference)}.I${String(index + 1).padStart(4, '0')}`,
        sub_transaction_type: "BILL Payment",
        bill_partner_company_name: "AES",
        bill_partner_company_code: "AES",
        bill_number: document.invoice,
        bill_account_number: document.contract,
        bill_due_date: " ", // Handle appropriately
        paid_amount: document.amountTopaid.toString(),
        paid_date: timestamp.format('DD/MM/YYYY HH:mm:ss'),
        paid_by_msisdn: document.reference,
        transaction_status: "Success",
        om_bill_payment_status: "Bill Paid",
        integration_status: EventIntegrationType.WAIT_GENERATION
      }));

    // Create documents in a single batch operation
    if (integrationDocuments.length > 0) {
      await prismaClient.integrationDocument.createMany({ data: integrationDocuments });
      writeLogEntry(`JOB : add_document_entry --> Created ${integrationDocuments.length} new integration documents.`, LogLevel.INFO, LogType.GENERAL, integrationDocuments);
    }

    // for (const document of documents) {

    //   const exist = await prismaClient.integrationDocument.findFirst({
    //     where: { transactionDetailsId: document.id }
    //   });

    //   if (!exist) {
    //     let currentNumber = 1;
    //     const data = {
    //       reference: document.reference, // Adjust as needed
    //       transactionId: document.transactionId, // Ensure this matches your data
    //       transactionDetailsId: document.id, // Ensure this matches your data
    //       transaction_id: `AC${moment().format('DDMMYYYY')}.${moment().format('HHmm')}.I${String(currentNumber).padStart(5, '0')}`, // Ensure this matches your data
    //       sub_transaction_type: "BILL Payment",
    //       bill_partner_company_name: "AES",
    //       bill_partner_company_code: "AES",
    //       bill_number: document.invoice,
    //       bill_account_number: document.contract,
    //       bill_due_date: " ", // Make sure this is handled appropriately
    //       paid_amount: document.amountTopaid.toString(),
    //       paid_date: moment().format('DD/MM/YYYY HH:mm:ss'),
    //       paid_by_msisdn: "724113114", // Adjust as needed
    //       transaction_status: "Success",
    //       om_bill_payment_status: "Bill Paid",
    //       integration_status: EventIntegrationType.PENDING
    //     };

    //     await prismaClient.integrationDocument.create({ data });
    //     currentNumber++;
    //     writeLogEntry(`creating new integration document ref: ${document.reference}`, LogLevel.INFO, LogType.GENERAL, data);

    //   } else {
    //     writeLogEntry("Document already exists", LogLevel.ERROR, LogType.GENERAL, [exist]);
    //   }
    // }
    // writeLogEntry('JOB : add_document_entry --> end', LogLevel.INFO, LogType.GENERAL);
  } catch (error) {
    writeLogEntry("JOB : add_document_entry --> Fail to generate document", LogLevel.ERROR, LogType.GENERAL, [error]);
  }
};


//---------------------------------------------------------
//         For each invoice, retrieve CMS integration status and update ICN
//---------------------------------------------------------
export const update_document_entry_status = async () => {
  // writeLogEntry('JOB : update_document_entry_status --> start', LogLevel.INFO, LogType.GENERAL);
  try {
    const query = `SELECT *
    FROM transactions t 
    JOIN transaction_details td ON td.transactionId = t.id
    JOIN integration_documents id ON td.id = id.transactionDetailsId
    WHERE 
    (t.statusId = 8 OR t.statusId = 9)
    AND td.selected = 1
    AND id.integration_status in ('${EventIntegrationType.GENERATED}','${EventIntegrationType.PENDING}','${EventIntegrationType.ONGOING}','${EventIntegrationType.ONGOING_WITH_ISSUE}')  
  `

    const documents: any = await prismaClient.$queryRawUnsafe(query);

    // Early exit if no documents found
    if (documents.length === 0) {
      // writeLogEntry('JOB : update_document_entry_status --> No documents to process.', LogLevel.INFO, LogType.GENERAL);
      // writeLogEntry('JOB : update_document_entry_status --> end', LogLevel.INFO, LogType.GENERAL);
      return null;
    }

    const statusMap: { [key: string]: EventIntegrationType } = {
      'OS001': EventIntegrationType.ONGOING,
      'OS002': EventIntegrationType.ONGOING_WITH_ISSUE,
      'OS005': EventIntegrationType.INTEGRATED
    };

    const transactionStatusUpdates: { [transactionId: string]: { id: number, status: EventIntegrationType }[] } = {};

    // loop on all transactions and documents
    for (const document of documents) {
      const result = await executeQuery(sqlQuery.icn_search_bill_status, [document.bill_number,document.reference]);

      const statusKey = result?.rows?.[0]?.[1] || null;

      let newStatus;
      if (statusKey && statusMap[statusKey]) {
        newStatus = statusMap[statusKey];
        await prismaClient.integrationDocument.update({
          where: { id: document.id },
          data: { integration_status: newStatus }
        });
      } else {
        newStatus = EventIntegrationType.PENDING;
        // writeLogEntry(`JOB : update_document_entry_status --> Unknown status key: ${statusKey} for document ID: ${document.id}.`, LogLevel.INFO);
        await prismaClient.integrationDocument.update({
          where: { id: document.id },
          data: { integration_status: newStatus }
        });
      }
    }

    //writeLogEntry('JOB : update_document_entry_status --> end', LogLevel.INFO, LogType.GENERAL);
  } catch (error) {
    writeLogEntry("JOB : update_document_entry_status --> Fail to update document entry", LogLevel.ERROR, LogType.GENERAL, [error]);
  }
};

//---------------------------------------------------------
//         For each invoice, retrieve CMS integration status and update ICN
//---------------------------------------------------------
export const close_transaction_all_document_entry_status_integrated = async () => {
  // writeLogEntry('JOB : update_document_entry_status --> start', LogLevel.INFO, LogType.GENERAL);
  try {
    const transactions = await prismaClient.transaction.findMany({
      where: { statusId: 8 },
      select: { id: true, reference: true }
    });


    for (const transaction of transactions) {
      let closeTransaction = true;
      const invoices = await prismaClient.transactionDetail.findMany({
        where: {
          AND: [
            { transactionId: transaction.id },
            { selected: true }
          ]
        },
      });

      for (const invoice of invoices) {
        const result = await executeQuery(sqlQuery.icn_search_bill_status, [invoice.invoice,transaction.reference]);
        const exist = result?.rows?.[0];

        if (!exist) {
          console.log('invoice : ' + invoice.invoice + '- transaction :' + invoice.transactionId + ' not integrated in CMS')
          closeTransaction = false;
          writeLogEntry('JOB : close_transaction_all_document_entry_status_integrated --> invoice : ' + invoice.invoice + '- transaction :' + invoice.transactionId + 'not yet integrated in CMS', LogLevel.INFO, LogType.GENERAL);
        }

      }

      if (closeTransaction) {
        // Update transaction
        const updatedTransaction = await prismaClient.transaction.update({
          where: { id: transaction.id },
          data: { statusId: 9 }
        });

        //Notify the key account manager and the person who create the transaction

        // Prepare notifications for the key account manager and the user who created the transaction
        const usersToNotify = [
          { id: updatedTransaction.userId, subject: "Transaction Treated and Integrated", message: `Transaction ID: ${updatedTransaction.reference} has been processed and integrated into the CMS.Now You can edit the fog (Brouillard) for more details.` },
          { id: updatedTransaction.createdBy, subject: "Transaction Treated and Integrated", message: `Your transaction ID: ${updatedTransaction.reference} has been processed and integrated into the CMS. Now You can edit the fog (Brouillard) for more details.` }
        ];

        // Notify users
        await Promise.all(usersToNotify.map(async ({ id, subject, message }) => {
          if (id) {
            const user = await prismaClient.user.findFirst({ where: { id } });
            if (user) {
              await prismaClient.notification.create({
                data: {
                  email: user.email,
                  message,
                  method: NotificationMethod.EMAIL,
                  subject,
                  template: "notification.mail.ejs",
                },
              });
            }
          }
        }));

        // break; //Interup the loop
      }

    }

    // const transactionStatusUpdates: { [transactionId: string]: { id: number, status: EventIntegrationType }[] } = {};

    // // loop on all transactions and documents
    // for (const document of documents) {
    //   const result = await executeQuery(sqlQuery.icn_search_bill_status, [document.bill_number]);
    //   const statusKey = result?.rows?.[0]?.[1] || null;
    //   // console.log("document.bill_number",document.bill_number,"document.integration_status",document.integration_status,"statusKey",statusKey)
    //   let newStatus;

    //   if (statusKey && statusMap[statusKey]) {
    //     newStatus = statusMap[statusKey];
    //     await prismaClient.integrationDocument.update({
    //       where: { id: document.id },
    //       data: { integration_status: newStatus }
    //     });
    //   } else {
    //     newStatus = EventIntegrationType.PENDING;
    //     // writeLogEntry(`JOB : update_document_entry_status --> Unknown status key: ${statusKey} for document ID: ${document.id}.`, LogLevel.INFO);
    //     await prismaClient.integrationDocument.update({
    //       where: { id: document.id },
    //       data: { integration_status: newStatus }
    //     });
    //   }

    //   // Track the integration status for the transaction
    //   const transactionId = document.transactionId;
    //   if (!transactionStatusUpdates[transactionId]) {
    //     transactionStatusUpdates[transactionId] = [];
    //   }
    //   transactionStatusUpdates[transactionId].push({
    //     id: document.id,
    //     status: newStatus
    //   });
    // }

    // // Update each transaction if all associated integration documents are INTEGRATED
    // const updatePromises = Object.keys(transactionStatusUpdates).map(async (transactionId) => {
    //   const statuses = transactionStatusUpdates[transactionId];
    //   const allIntegrated = statuses.every(item => item.status === EventIntegrationType.INTEGRATED);

    //   if (allIntegrated) {
    //     const updatedTransaction = await prismaClient.transaction.update({
    //       where: { id: transactionId },
    //       data: { statusId: 9 }
    //     });

    //     //Notify the key account manager and the person who create the transaction

    //     // Prepare notifications for the key account manager and the user who created the transaction
    //     const usersToNotify = [
    //       { id: updatedTransaction.userId, subject: "Transaction Treated and Integrated", message: `Transaction ID: ${updatedTransaction.reference} has been processed and integrated into the CMS. You can edit the fog (Brouillard) for more details.` },
    //       { id: updatedTransaction.createdBy, subject: "Transaction Treated and Integrated", message: `Your transaction ID: ${updatedTransaction.reference} has been processed and integrated into the CMS. You can edit the fog (Brouillard) for more details.` }
    //     ];

    //     // Notify users
    //     await Promise.all(usersToNotify.map(async ({ id, subject, message }) => {
    //       if (id) {
    //         const user = await prismaClient.user.findFirst({ where: { id } });
    //         if (user) {
    //           await prismaClient.notification.create({
    //             data: {
    //               email: user.email,
    //               message,
    //               method: NotificationMethod.EMAIL,
    //               subject,
    //               template: "notification.mail.ejs",
    //             },
    //           });
    //         }
    //       }
    //     }));

    //     writeLogEntry('JOB : update_document_entry_status --> updaye', LogLevel.INFO, LogType.GENERAL,);
    //   }
    // });

    // // Wait for all updates to complete
    // await Promise.all(updatePromises);

    //writeLogEntry('JOB : update_document_entry_status --> end', LogLevel.INFO, LogType.GENERAL);
  } catch (error) {
    writeLogEntry("JOB : update_document_entry_status --> Fail to update document entry", LogLevel.ERROR, LogType.GENERAL, [error]);
  }
};


//---------------------------------------------------------
//         For each invoice, retrieve CMS integration status and update ICN
//---------------------------------------------------------
export const transaction_receipt_all_document_entry_status_integrated = async () => {
  // writeLogEntry('JOB : update_document_entry_status --> start', LogLevel.INFO, LogType.GENERAL);
  try {
    const transactions = await prismaClient.transaction.findMany({
      where: { statusId: 9, isReceiptReady: false },
      select: { id: true, reference: true }
    });

    for (const transaction of transactions) {
      console.log("Transaction ID:", transaction.reference);
      const nb = await prismaClient.transactionDetail.count({
        where: {
          AND: [
            { transactionId: transaction.id },
            { selected: true }
          ]
        },
      });
      console.log("Number of selected details:", nb);
      const nbValidate = await prismaClient.integrationDocument.count({
        where: {
          AND: [
            { transactionId: transaction.id },
            { integration_status: EventIntegrationType.INTEGRATED }
          ]
        },
      });
      console.log("Number of validated documents:", nbValidate);
      if (nb === nbValidate) {
        // Update transaction
        const updatedTransaction = await prismaClient.transaction.update({
          where: { id: transaction.id },
          data: { isReceiptReady: true }
        });

        //Notify the key account manager and the person who create the transaction

        // Prepare notifications for the key account manager and the user who created the transaction
        const usersToNotify = [
          { id: updatedTransaction.userId, subject: "Transaction receipt available", message: `Transaction ID: ${updatedTransaction.reference} is now available . You can export it in the platform.` },
          //{ id: updatedTransaction.createdBy, subject: "Transaction Treated and Integrated", message: `Your transaction ID: ${updatedTransaction.reference} has been processed and integrated into the CMS. Now You can edit the fog (Brouillard) for more details.` }
        ];

        // Notify users
        await Promise.all(usersToNotify.map(async ({ id, subject, message }) => {
          if (id) {
            const user = await prismaClient.user.findFirst({ where: { id } });
            if (user) {
              await prismaClient.notification.create({
                data: {
                  email: user.email,
                  message,
                  method: NotificationMethod.EMAIL,
                  subject,
                  template: "notification.mail.ejs",
                },
              });
            }
          }
        }));
      }
    }

  } catch (error) {
    writeLogEntry("JOB : update_document_entry_status --> Fail to update document entry", LogLevel.ERROR, LogType.GENERAL, [error]);
  }
};


//---------------------------------------------------------
//         Generate the ACI brouillard using session_id
//---------------------------------------------------------
export const transaction_brouillard_generation = async (req: Request, res: Response, next: NextFunction) => {
  let reference = req.params.reference;
  if (!reference) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

  try {
    // D'abord, récupérez la transaction pour obtenir son ID
    // const transaction = await getTransaction(reference);
    // if (!transaction) {
    //   return res.status(404).json({ success: false, message: 'Transaction not found' });
    // }
    // if (!transaction.reference) {
    //   return res.status(404).json({ success: false, message: 'Transaction reference not found' });
    // }

    // // Ensuite, si la transaction existe, récupérez ses détails
    // const documents = await getIntegrationDocuments(transaction.id);
    // if (documents.length === 0) {
    //   return res.status(404).json({ success: true, message: 'Invoices Not integrated in CMS' });
    // }

    // if (documents.length <= 0) {
    //   return res.status(404).json({
    //     success: true,
    //     message: "Invoices Not integrate in CMS"
    //   });
    // }
    
    // reference = transaction.reference
    const session = await getSession(reference); // const session = 20156987; // prod testing
    if (!session) {
      return res.status(404).json({ success: true, message: 'Error downloading file: no CMS session available' });
    }

    const conn = new Client();

    let storedOutput: string | null = null;
    const outputDir = path.join(__dirname, '../../output/brouillard');
    // Create 'output' directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true }); // Using recursive option for safety
    }
   

    conn.on('ready', () => {
      console.log('Client :: ready');
      conn.exec(`${SCRIPT_GENERATION_BROUILLARD} -s ${session}`, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code: string, signal: string) => {
          console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);

          if (storedOutput) {
            // Copie du fichier vers la machine locale
            const remoteFilePath = `${SCRIPT_GENERATION_BROUILLARD_OUTPUT}${storedOutput}`;
            const localFilePath = path.join(outputDir, storedOutput); // Changez le chemin selon vos besoins

            conn.sftp((err, sftp) => {
              if (err) {
                return res.status(500).json({
                  success: false,
                  message: "Error establishing SFTP connection"
                });
              }
              sftp.fastGet(remoteFilePath, localFilePath, (err) => {
                if (err) {
                  return res.status(500).json({
                    success: false,
                    message: "Error downloading file"
                  });
                }
                console.log(`Fichier ${storedOutput} copié vers ${localFilePath}`);
                // Envoi du fichier en réponse au client
                res.download(localFilePath, (err) => {
                  if (err) {
                    console.log('Error sending file:', err);
                  }
                  // Optionnel : Supprimez le fichier local après l'envoi
                  fs.unlinkSync(localFilePath);
                  conn.end();
                });
                conn.end();
              });
            });
          } else {
            return res.status(500).json({ success: false, aci:reference, session , message: 'No output file generated' });
            conn.end();
          }

        }).on('data', (data: string) => {
          console.log('STDOUT: ' + data);
          const outputString = data.toString();
          const name = `BROUILLARD_ACI_NUMERO_${reference}_SESSION_${session}_`;
          // const regex = /BROUILLARD_ACI_NUMERO_112411113_SESSION_20181706_(.+?).xlsx/; // Expression régulière pour extraire la référence
          const regex = new RegExp(`${name}(.+?).xlsx`);
          const match = outputString.match(regex);
          console.log("match",match)
          if (match && match[0]) {
            storedOutput = match[0]; // Stocke la référence si trouvée
          }
        }).stderr.on('data', (data) => {
          console.log('STDERR: ' + data);
        });

        stream.end('echo fichier genere\n');
      });
    }).connect({
      host: '10.250.90.200',
      port: 22,
      username: 'sdsa.user',
      password: 'Sds@eneo',
      // privateKey: require('fs').readFileSync('/chemin/vers/votre/cle')  // ou utilisez une clé privée
    });
  } catch (error) {
    console.log("BROUILLARD-GENERATION")
    writeLogEntry("JOB : transaction_brouillard_generation --> ", LogLevel.ERROR, LogType.GENERAL, [error]);
  }
};


//-----------------------------------------------
//        lock_users_transaction
//-----------------------------------------------  
export const clear_lock_users_transactions = async () => {

  writeLogEntry('JOB : clearLock --> start', LogLevel.INFO, LogType.GENERAL);

  // Fetch data from the database
  const documents = await prismaClient.transactionTempUser.deleteMany();

  // selectionner tous les utilisateurs qui ne sont pas connecter 
  // pour tous les utilisateur non connecter supprimer le lock

}

//-----------------------------------------------
//        FTP transfert payment file
//-----------------------------------------------  
// import { FTPClient } from 'basic-ftp';

// // Configuration
// const FTP_HOST = '10.111.108.153' //'ftp.example.com';
// const FTP_USER = 'your_username';
// const FTP_PASS = 'your_password';
// const LOCAL_DIR = '../../output'; //'/path/to/local/files';
// const REMOTE_DIR = '/home/sys_emoney/sonel_tparties/aci/paid';
// const SAVE_DIR = '../../output/send';

// // Fonction pour envoyer des fichiers via FTP
// async function sendFiles() {
//     const client = new FTPClient();
//     try {
//         await client.access({
//             host: FTP_HOST,
//             user: FTP_USER,
//             password: FTP_PASS,
//             secure: false, // Changez à true si vous utilisez FTPS
//         });
//         await client.cd(REMOTE_DIR);

//         const files = fs.readdirSync(LOCAL_DIR);

//         for (const file of files) {
//             const localFilePath = path.join(LOCAL_DIR, file);
//             const saveFilePath = path.join(SAVE_DIR, file);

//             if (fs.statSync(localFilePath).isFile()) {
//                 console.log(`Transferring ${file}...`);
//                 await client.uploadFrom(localFilePath, file);
//                 console.log(`Successfully transferred ${file}`);

//                 // Déplacer le fichier vers le répertoire "save"
//                 fs.renameSync(localFilePath, saveFilePath);
//                 console.log(`Moved ${file} to save directory`);
//             }
//         }
//     } catch (error) {
//         console.error(`Error during FTP transfer: ${error}`);
//     } finally {
//         client.close();
//     }
// }

// // Planifier la tâche cron
// cron.schedule('0 2 * * *', () => {
//     console.log('Running scheduled task...');
//     sendFiles();
// }, {
//     scheduled: true,
//     timezone: "Europe/Paris" // Ajustez selon votre fuseau horaire
// });





//-----------------------------------------------
//        add_document_entry document
//-----------------------------------------------
cron.schedule('* * * * * *', async () => await run_job("add_document_entry", add_document_entry));


//---------------------------------------------------------
//              generate_document
//---------------------------------------------------------
// cron.schedule('0 */2 * * * *', async () => await run_job("generate_document", generationIntegrationFile));
cron.schedule('* * * * *', async () => await run_job("generate_document", generationIntegrationFile));


//-----------------------------------------------
//        Job for each invoice, retrieve CMS integration status and update ICN
//-----------------------------------------------
// cron.schedule('*/30 * * * *', async () => await run_job("update_document_entry_status", update_document_entry_status));
cron.schedule('* * * * *', async () => await run_job("update_document_entry_status", update_document_entry_status));


//-----------------------------------------------
//       Job for closing the ticket where all invoices documents are integrated into CMS
//-----------------------------------------------
cron.schedule('* * * * *', async () => await run_job("close_transaction_all_document_entry_status_integrated", close_transaction_all_document_entry_status_integrated));


//-----------------------------------------------
//       Job for enabled the receip generation if all CMS intergrated invoice are in status OS005
//-----------------------------------------------
cron.schedule('* * * * *', async () => await run_job("transaction_receipt_all_document_entry_status_integrated", transaction_receipt_all_document_entry_status_integrated));



//-----------------------------------------------
//       Job for clearing user lock transactions
//-----------------------------------------------
cron.schedule('0 16,05 * * *', async () => await run_job("clear_lock_users_transactions", clear_lock_users_transactions));


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
      writeLogEntry(`JOB : ${job_name} first initialisation`, LogLevel.INFO, LogType.DATABASE, init);
      return
    }

    // Check if the job is already running
    if (lock.is_running) {
      writeLogEntry(`JOB : ${job_name} is already running. Exiting...`, LogLevel.INFO, LogType.DATABASE);
      return; // Exit if another instance is running
    }

    // Set the lock to true
    await prismaClient.jobLock.update({
      where: { job_name },
      data: { is_running: true }
    });

    job();

  } catch (error) {
    writeLogEntry("Fail to generate document", LogLevel.ERROR, LogType.GENERAL, [error]);
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


const getTransaction = async (reference: string) => {
  return await prismaClient.transaction.findFirst({
    where: { reference },
    select: { id: true, reference: true }
  });
};

const getIntegrationDocuments = async (transactionId: string) => {
  return await prismaClient.integrationDocument.findMany({
    where: { transactionId },
    select: { transaction_id: true, bill_number: true }
  });
};

const getSession = async (AciNber: string) => {
  const result = await executeQuery(sqlQuery.icn_search_bill_status_by_aci_number_offline_collections, [AciNber]);
  console.log("getSession",result)
  return result?.rows?.[0]?.[2] || null; // Assuming the session is in the 6th column
};

