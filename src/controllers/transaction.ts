import { NextFunction, Request, Response } from "express";
import { NotificationMethod, SourceType, Transaction } from '@prisma/client';

import { redis } from "../core/utils/redis";
import prismaClient from "../core/utils/prismadb";
import { getUserConnected } from "../core/utils/authentificationService";
import { convertDateToDBFormat, getCurrentMonthYear, parseDMY } from "../core/utils/formatter";

import ConfigurationException from "../core/exceptions/configuration";
import UnauthorizedException from "../core/exceptions/unauthorized";
import BadRequestException from "../core/exceptions/bad-requests";
import { ErrorCode } from "../core/exceptions/http-exception";
import NotFoundException from "../core/exceptions/not-found";

import { createSchema, idSchema, transactionSchema, unicitySchema } from "../schema/transactions";
import { appConfig } from "../config/app.config";
import { EventType } from "../constants/enum";
import { REDIS_SESSION_EXPIRE } from "../secrets";

interface TransactionWithRelations extends Transaction {
  bank?: {
    name: string;
  };
  paymentMode?: {
    name: string;
  };
  unit?: {
    name: string;
  };
  region?: {
    name: string;
  };
  status?: {
    name: string;
  };
  user?: {
    name: string;
  };
  validator?: {
    name: string;
  }
  creator?: {
    name: string;
  }
  modifier?: {
    name: string;
  }
}

// Redis key
const key = 'transactions';

type notificationType = "edit" | "publish" | "reject" | "validate" | "assign" | "submit" | "verifie" | "verifie-refusal" | "treat";

//-----------------------------------------------------------------------------
//             CREATE TRANSACTIONS : post /transactions
//-----------------------------------------------------------------------------

// ITransactionRequest
interface ITransactionRequest {
  name: string;
  amount: number;
  bank: string;
  payment_date: Date;
  payment_mode: string;
  description?: string
}

// Handling create process
export const create =
  async (req: Request, res: Response, next: NextFunction) => {

    // Validate the incoming request data using the defined schema
    const parsedTransaction = createSchema.parse(req.body as ITransactionRequest);

    // Retrieve the connected user for audit and notification purposes 
    const user = await getUserConnected(req);

    // Find the 'draft' status to assign to the new transaction
    const status = await prismaClient.status.findFirst({ where: { name: 'draft' } })

    // Find the 'draft' status to assign to the new transaction
    const transaction = await prismaClient.transaction.create({
      data: {
        name: parsedTransaction.name,
        amount: parsedTransaction.amount,
        bankId: parsedTransaction.bank,
        branchId: parsedTransaction.branch,
        description: parsedTransaction.description,
        statusId: status?.id,
        paymentModeId: parsedTransaction.payment_mode,
        adviceDuplication: parsedTransaction.advice_duplication ?? false,
        paymentDate: parseDMY(parsedTransaction.payment_date),
        createdBy: user.id,
        modifiedBy: user?.id,
        userId: user?.id
      },
    });

    // Revalidate associated services after creating the transaction
    revalidateService(key);

    // Respond with the details of the created transaction
    res.status(201).json({
      success: true,
      data: transaction,
    });

    // Create an email notification to inform the user of the new transaction
    await prismaClient.notification.create({
      data: {
        email: user.email,
        message: `A new transaction has been created with the following details :     - **Status** : Draft ,   - **Customer** : ${transaction.name} , - **Amount** : ${transaction.amount} , - **Payment Date** : ${transaction.paymentDate} . Please review the transaction at your earliest convenience.`,
        method: NotificationMethod.EMAIL,
        subject: "New transaction have been created successfully.",
        template: "notification.mail.ejs",
      },
    });

    // Log an audit entry for tracking user actions
    await prismaClient.audit.create({
      data: {
        userId: user.id,
        ipAddress: req.ip,
        action: EventType.TRANSACTION,
        details: `User : ${user.email} created new Transaction : ${JSON.stringify(transaction)}`,
        endpoint: '/transactions',
        source: SourceType.USER
      },
    });


  };


//-----------------------------------------------------------------------------
//             GET ALL TRANSACTIONS :  get /transactions
//-----------------------------------------------------------------------------

// Handling get process   
export const get =
  async (req: Request, res: Response, next: NextFunction) => {

    const soft = req.user?.role.name !== "ADMIN" ? { deleted: false } : {};

    //TODO : optimize this function
    let query: any = {
      include: {
        bank: {
          select: {
            name: true,
          },
        },
        paymentMode: {
          select: {
            name: true,
          },
        },
        status: {
          select: {
            name: true,
          },
        },
        unit: {
          select: {
            name: true,
          },
        },
        region: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
        validator: {
          select: {
            name: true,
          },
        },
        creator: {
          select: {
            name: true,
          },
        },
        modifier: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    };

    // Extracting the status filter from the request query
    const { status } = req.query;

    if (status) {
      const validStatus = await prismaClient.status.findFirst({
        where: { name: status.toString() },
      });

      if (!validStatus) throw new BadRequestException('Invalid status filter', ErrorCode.INVALID_DATA);

      query = {
        where: { statusId: validStatus.id },
        ...query
      }

    };

    const { userId } = req.query
    if (userId) {
      const validUserId = await prismaClient.user.findFirst({
        where: { id: userId.toString() },
      });

      if (!validUserId) throw new BadRequestException('Invalid status filter', ErrorCode.INVALID_DATA);
      query = {
        where: { userId: validUserId.id },
        ...query
      }
    };

    if (soft) {
      query = {
        where: soft,
        ...query
      }
    }

    const transactions = await prismaClient.transaction.findMany(query) as TransactionWithRelations[];

    const result = transactions.map((item) => ({
      ...item,
      status: item?.status?.name,
      bank: item?.bank?.name,
      unit: item?.unit?.name,
      region: item?.region?.name,
      payment_mode: item?.paymentMode?.name,
      payment_date: item?.paymentDate,
      assignTo: item?.user?.name,
      validatedBy: item?.validator?.name,
      modifiedBy: item?.modifier?.name,
      createdBy: item?.creator?.name,
      createdById: item?.createdBy
    }));

    // Revalidate associated services after creating the transaction
    revalidateService(key);

    return res.status(200).json({
      success: true,
      data: result,
    });
  };


//------------------------------------------------------------------------------------------
//             GET ALL TRANSACTIONS ALL :  get /transactions/all
//-------------------------------------------------------------------------------------------
export const getWithPaginationAndComplexeFilterFeatureOptimizeForPrisma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Extract and parse filters
    const filters = req.query.filters as string || '';
    let parsedFilters;

    try {
      parsedFilters = filters ? JSON.parse(filters) : {};
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format for filters. Please provide valid JSON.'
      });
    }

    const whereClause: any = [];

    // Function to create a Prisma filter from provided filter data
    const createFilter = ({ field, operator, value }: { field: string; operator: string; value: any }) => {
      if (!field || value === undefined) {
        throw new Error(`Each filter must include 'field' and 'value'.`);
      }

      const prismaOperatorMap: any = {
        contains: { contains: value },
        equals: { equals: value },
        gte: { gte: value },
        lte: { lte: value },
        gt: { gt: value },
        lt: { lt: value }
      };

      const prismaCondition = prismaOperatorMap[operator];
      if (!prismaCondition) {
        throw new Error(`Operator '${operator}' is not supported.`);
      }

      return { [field]: prismaCondition };
    };

    // Process conditions
    if (Array.isArray(parsedFilters.conditions)) {
      for (const condition of parsedFilters.conditions) {
        const { operator, filters: conditionFilters } = condition;

        if (!Array.isArray(conditionFilters) || !conditionFilters.length) {
          return res.status(400).json({
            success: false,
            message: 'Each condition must include an array of filters.'
          });
        }

        const conditionObject = conditionFilters.map(createFilter);
        const combinedCondition = operator === 'AND' ? { AND: conditionObject } : { OR: conditionObject };
        whereClause.push(combinedCondition);
      }
    } else {
      // Process simple filters
      for (const key in parsedFilters) {
        const { operator = 'equals', value } = parsedFilters[key];
        whereClause.push(createFilter({ field: key, operator, value }));
      }
    }

    // Combine final where clause
    const combinedWhereClause = whereClause.length ? { AND: whereClause } : {};

    // Get the total count of records
    const totalItems = await prismaClient.v_Transactions_available.count({
      where: combinedWhereClause,
    });

    // Fetch paginated records
    const data = await prismaClient.v_Transactions_available.findMany({
      where: combinedWhereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // Respond with data and pagination info
    res.status(200).json({
      success: true,
      data,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, message: errorMessage });
  }
};

//------------------------------------------------------------------------------------------
//             GET ALL TRANSACTIONS AWAITTING KAM INUT AND ELIGIBLE FOR UNASSGINMENT :  get /transactions/unassignments
//-------------------------------------------------------------------------------------------
export const getAwaitingKamInputEligibleForUnassignmentWithPaginationAndComplexeFilterFeatureOptimizeForPrisma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Extract and parse filters
    const filters = req.query.filters as string || '';
    let parsedFilters;

    try {
      parsedFilters = filters ? JSON.parse(filters) : {};
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format for filters. Please provide valid JSON.'
      });
    }

    const whereClause: any = [];

    // Function to create a Prisma filter from provided filter data
    const createFilter = ({ field, operator, value }: { field: string; operator: string; value: any }) => {
      if (!field || value === undefined) {
        throw new Error(`Each filter must include 'field' and 'value'.`);
      }

      const prismaOperatorMap: any = {
        contains: { contains: value },
        equals: { equals: value },
        gte: { gte: value },
        lte: { lte: value },
        gt: { gt: value },
        lt: { lt: value }
      };

      const prismaCondition = prismaOperatorMap[operator];
      if (!prismaCondition) {
        throw new Error(`Operator '${operator}' is not supported.`);
      }

      return { [field]: prismaCondition };
    };

    // Process conditions
    if (Array.isArray(parsedFilters.conditions)) {
      for (const condition of parsedFilters.conditions) {
        const { operator, filters: conditionFilters } = condition;

        if (!Array.isArray(conditionFilters) || !conditionFilters.length) {
          return res.status(400).json({
            success: false,
            message: 'Each condition must include an array of filters.'
          });
        }

        const conditionObject = conditionFilters.map(createFilter);
        const combinedCondition = operator === 'AND' ? { AND: conditionObject } : { OR: conditionObject };
        whereClause.push(combinedCondition);
      }
    } else {
      // Process simple filters
      for (const key in parsedFilters) {
        const { operator = 'equals', value } = parsedFilters[key];
        whereClause.push(createFilter({ field: key, operator, value }));
      }
    }

    // Combine final where clause
    const combinedWhereClause = whereClause.length ? { AND: whereClause } : {};

    // Get the total count of records
    const totalItems = await prismaClient.v_transactions_eligible_for_unassignment.count({
      where: combinedWhereClause,
    });

    // Fetch paginated records
    const data = await prismaClient.v_transactions_eligible_for_unassignment.findMany({
      where: combinedWhereClause,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    // Respond with data and pagination info
    res.status(200).json({
      success: true,
      data,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, message: errorMessage });
  }
};


//------------------------------------------------------------------------------------------
//             GET ALL TRANSACTIONS AWAITTING ASSIGNATIONS :  get /transactions/assignments
//-------------------------------------------------------------------------------------------
export const getAwaitingAssignationWithPaginationAndComplexeFilterFeatureOptimizeForPrisma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Extract and parse filters
    const filters = req.query.filters as string || '';
    let parsedFilters;

    try {
      parsedFilters = filters ? JSON.parse(filters) : {};
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format for filters. Please provide valid JSON.'
      });
    }

    const whereClause: any = [];

    // Function to create a Prisma filter from provided filter data
    const createFilter = ({ field, operator, value }: { field: string; operator: string; value: any }) => {
      if (!field || value === undefined) {
        throw new Error(`Each filter must include 'field' and 'value'.`);
      }

      const prismaOperatorMap: any = {
        contains: { contains: value },
        equals: { equals: value },
        gte: { gte: value },
        lte: { lte: value },
        gt: { gt: value },
        lt: { lt: value }
      };

      const prismaCondition = prismaOperatorMap[operator];
      if (!prismaCondition) {
        throw new Error(`Operator '${operator}' is not supported.`);
      }

      return { [field]: prismaCondition };
    };

    // Process conditions
    if (Array.isArray(parsedFilters.conditions)) {
      for (const condition of parsedFilters.conditions) {
        const { operator, filters: conditionFilters } = condition;

        if (!Array.isArray(conditionFilters) || !conditionFilters.length) {
          return res.status(400).json({
            success: false,
            message: 'Each condition must include an array of filters.'
          });
        }

        const conditionObject = conditionFilters.map(createFilter);
        const combinedCondition = operator === 'AND' ? { AND: conditionObject } : { OR: conditionObject };
        whereClause.push(combinedCondition);
      }
    } else {
      // Process simple filters
      for (const key in parsedFilters) {
        const { operator = 'equals', value } = parsedFilters[key];
        whereClause.push(createFilter({ field: key, operator, value }));
      }
    }

    // Combine final where clause
    const combinedWhereClause = whereClause.length ? { AND: whereClause } : {};

    // Get the total count of records
    const totalItems = await prismaClient.v_transactions_to_assign.count({
      where: combinedWhereClause,
    });

    // Fetch paginated records
    const data = await prismaClient.v_transactions_to_assign.findMany({
      where: combinedWhereClause,
      orderBy: { reference: 'asc' },
      skip,
      take: limit,
    });

    // Respond with data and pagination info
    res.status(200).json({
      success: true,
      data,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, message: errorMessage });
  }
};


//-----------------------------------------------------------------------------
//             GET TRANSACTIONS BY ID : get /transactions/:id
//-----------------------------------------------------------------------------

// Handling the process GET transaction by ID 
export const getById =
  async (req: Request, res: Response, next: NextFunction) => {

    // Extract the 'id' parameter from the request
    const id = req.params.id;

    // Validate the 'id' parameter; if it's missing, throw a BadRequestException
    if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

    let data;

    // Check if the provided 'id' exists in the cache
    const isCachedExist = await redis.get(id);
    if (isCachedExist) {
      // If cached data exists, parse and use it
      data = JSON.parse(isCachedExist);
    } else {
      // If not cached, retrieve the transaction data from the database using the idService
      data = idService(id);
    }

    // Respond with the retrieved data, converting the amount to a string for consistency
    return res.status(200).json({
      success: true,
      data: {
        ...data,
        amount: data.amount.toString(), // Convert amount to string for JSON response
      }
    });
  };


//-----------------------------------------------------------------------------
//             UPDATE TRANSACTIONS : put  /transactions/:id
//-----------------------------------------------------------------------------

// Handling Update transaction process
export const update =
  async (req: Request, res: Response, next: NextFunction) => {

    // Extract the 'id' parameter from the request
    const id = req.params.id;

    // Validate the 'id' parameter; if it's missing, throw a BadRequestException
    if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

    // Validate the provided ID using the idSchema
    const validatedId = idSchema.parse(id);

    // Initialize notification type for tracking
    let notificationType: notificationType = "edit";

    // Define forbidden fields that should not be included in the request body
    const forbiddenFields = [
      'createdAt', 'createdBy',
      'modifiedBy', 'deleted', 'deletedBy',
      'deletedAt'
    ];

    // Check for forbidden fields in the request body
    for (const field of forbiddenFields) {
      if (req.body[field]) {
        throw new UnauthorizedException("Unauthorized resource", ErrorCode.UNAUTHORIZED);
      }
    }

    // Retrieve user information for authorization checks
    const user = await prismaClient.user.findFirst({
      where: { id: req.user?.id },
    });
    if (!user) throw new UnauthorizedException("Unauthorize ressource", ErrorCode.UNAUTHORIZED);


    let data: any = {};

    // Populate data object with allowed fields from the request body
    if (req.body.name) {
      data.name = req.body.name
    };

    if (req.body.amount) {
      data.amount = req.body.amount
    };

    if (req.body.bank) {
      data.bankId = req.body.bank
    };

    if (req.body.branch) {
      data.branchId = req.body.branch
    };

    if (req.body.payment_mode) {
      data.paymentModeId = req.body.payment_mode
    };

    if (req.body.payment_date) {
      data.paymentDate = parseDMY(req.body.payment_date)
    }

    if (req.body.description) {
      data.description = req.body.description
    }

    if (req.body.advice_duplication) {
      data.adviceDuplication = req.body.advice_duplication;
    }

    // Validate and set the userId if provided
    if (req.body.userId) {
      const userWhoBeneficied = await prismaClient.user.findFirst({
        where: { id: req.body.userId },
      });
      if (!userWhoBeneficied) throw new BadRequestException("Bad request unvalidate userId", ErrorCode.UNAUTHORIZED);
      data.userId = userWhoBeneficied.id
    }

    // Validate and set the regionId if provided
    if (req.body.regionId) {
      const region = await prismaClient.region.findFirst({
        where: { id: req.body.regionId },
      });
      if (!region) throw new BadRequestException("Bad request unvalidate regionId", ErrorCode.UNAUTHORIZED);
      data.regionId = region.id
    }

    // Validate and set the unitId if provided
    if (req.body.unitId) {
      const unit = await prismaClient.unit.findFirst({
        where: { id: req.body.unitId },
      });
      if (!unit) throw new BadRequestException("Bad request unvalidate unitId", ErrorCode.UNAUTHORIZED);
      data.unitId = unit.id
    }

    // Check and handle the status field
    if (req.body.status) {
      const status = await prismaClient.status.findFirst({
        where: { name: req.body.status },
      });
      if (!status) throw new UnauthorizedException("Unauthorize ressource", ErrorCode.UNAUTHORIZED);

      data.statusId = parseInt(status.id.toString());
      const request = await prismaClient.transaction.findFirst({
        where: { id: id }
      });

      // Handling different status updates

      // For publish the request  (status === draft)
      if (req.body.status.toLocaleLowerCase() === appConfig.status[2].toLocaleLowerCase()) {
        if (!request?.reference && request?.paymentDate && request?.bankId) {
          const refId = await generateICNRef(request.paymentDate, request.bankId);
          data.reference = refId.reference
        }
        notificationType = "publish"
      }

      // For validation
      if (req.body.status.toLocaleLowerCase() === appConfig.status[3].toLocaleLowerCase()) {
        data.validatorId = user.id;
        data.validatedAt = new Date();
        notificationType = "validate"
      }

      // For Reject
      if (req.body.status.toLocaleLowerCase() === appConfig.status[4].toLocaleLowerCase()) {
        data.validatorId = user.id;
        data.validatedAt = new Date();
        data.refusal = true;
        data.reasonForRefusal = req.body.reasonForRefusal;
        notificationType = "reject"
      }

      // For assignment (Assignation)
      if (req.body.status.toLocaleLowerCase() === appConfig.status[5].toLocaleLowerCase()) {
        data.assignBy = user.id;
        data.assignAt = new Date();
        // when we assign we send and empty string for userId
        if ((data.unitId || data.regionId) && !data.userId) {
          data.userId = null
        }

        notificationType = "assign"

        const history = await prismaClient.v_Transactions_available.findUnique({
          where: { id: validatedId }
        });
        let region: any = null;
        if (data.regionId) {
          region = await prismaClient.region.findUnique({
            where: { id: data.regionId }
          })
        };
        let unit: any = null;
        if (data.unitId) {
          unit = await prismaClient.unit.findUnique({
            where: { id: data.unitId }
          });

        }

        // History
        await prismaClient.assignmentHistory.create({
          data: {
            reference: history?.reference ?? "",
            status: 'ASSIGN',
            OldAssignTo: history?.assignTo,
            OldUnit: history?.unit,
            OldRegion: history?.region,
            NewAssignTo: null,
            NewUnit: unit?.name,
            NewRegion: region?.name,
            createdBy: user.id
          },
        });

      }

      // For Submission
      if (req.body.status.toLocaleLowerCase() === appConfig.status[6].toLocaleLowerCase()) {
        await prismaClient.transactionTempUser.deleteMany({
          where: { transactionId: id },
        });

        notificationType = "submit"
      }

      // For verification (approved)
      if (req.body.status.toLocaleLowerCase() === appConfig.status[7].toLocaleLowerCase()) {
        data.verifierBy = user.id;
        data.verifierAt = new Date();
        notificationType = "verifie"
        await prismaClient.transactionTempUser.deleteMany({
          where: { transactionId: id },
        });
        if (request?.userId) {
          await prismaClient.transactionHistory.create({
            data: { transactionId: id, userId: request?.userId, verifierId: data.verifierBy, action: 'validate', reason: "" },
          });
        }
      }

      // For verification (not approved)
      if (req.body.status.toLocaleLowerCase() === appConfig.status[5].toLocaleLowerCase()) {
        if (req.body.verifierReasonForRefusal) {
          data.assignBy = request?.assignBy;
          data.assignAt = request?.assignAt;
          data.verifierBy = user.id;
          data.verifierAt = new Date();
          data.reasonForRefusal = req.body.verifierReasonForRefusal;

          notificationType = "verifie-refusal";
          await prismaClient.transactionTempUser.deleteMany({
            where: { transactionId: id },
          });
          if (request?.userId) {
            await prismaClient.transactionHistory.create({
              data: { transactionId: id, userId: request?.userId, verifierId: user.id, action: 'reject', reason: data.reasonForRefusal },
            });
          }
        }

      }

    }

    // Finalize the data object with modification details
    data = {
      ...data,
      modifiedBy: user.id,
      updatedAt: new Date()
    }

    // Update the transaction in the database
    const result = await prismaClient.transaction.update({
      where: { id: id },
      data: data,
    });

    // Optionally revalidate the ID and services
    idService(id);
    revalidateService(key);

    res.status(200).json({
      success: true,
      message: "Resource updated successfully",
      data: result,
    });

    // Notify the user about the event based on the notification type
    // This could include various types of notifications such as publish, validate, reject, etc.
    // Parameters:
    // - notificationType: The type of notification to send (e.g., "publish", "validate")
    // - result: The result of the transaction update, containing relevant details
    // - user: The user associated with the transaction, used to determine the recipient of the notification
    notification(notificationType, result, user)

    // Log an audit entry for tracking user actions
    await prismaClient.audit.create({
      data: {
        userId: user.id,
        ipAddress: req.ip,
        action: EventType.TRANSACTION,
        details: `User: ${user.email} has updated the transaction with ID: ${JSON.stringify(id)}. change value: ${JSON.stringify(data)}`,
        endpoint: '/transactions',
        source: SourceType.USER
      },
    });
  };



//-----------------------------------------------------------------------------
//             UPDATE TRANSACTIONS : put  /transactions/:id/unassignment
//-----------------------------------------------------------------------------

// Handling Update transaction process
export const unassignment =
  async (req: Request, res: Response, next: NextFunction) => {

    // Extract the 'id' parameter from the request
    const id = req.params.id;

    // Validate the 'id' parameter; if it's missing, throw a BadRequestException
    if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

    // Validate the provided ID using the idSchema
    const validatedId = idSchema.parse(id);

    // Retrieve user information for authorization checks
    const user = await getUserConnected(req);

    // Retrieve transaction information for history purposes
    const eligible = await prismaClient.v_transactions_eligible_for_unassignment.findFirst({
      where: { id: validatedId }
    });
    if (!eligible) throw new UnauthorizedException('Transactions is not unassignable', ErrorCode.INVALID_DATA)

    const transaction = await prismaClient.v_Transactions_available.findUnique({
      where: { id: validatedId }
    });
    if (!transaction) throw new BadRequestException('Transactions Not found', ErrorCode.INVALID_DATA)

    // For unassignment (Assignation)
    const data = {
      statusId: 4,
      regionId: null,
      unitId: null,
      userId: transaction.createdBy,
      assignBy: null,
      assignAt: null,
      modifiedBy: user.id,
      updatedAt: new Date()
    }
    const result = await prismaClient.transaction.update({
      where: { id: validatedId },
      data,
    });

    // History
    await prismaClient.assignmentHistory.create({
      data: {
        reference: transaction.reference ?? "",
        status: 'DISASSIGN',
        OldAssignTo: transaction.assignTo,
        OldUnit: transaction?.unit,
        OldRegion: transaction?.region,
        NewAssignTo: null,
        NewUnit: null,
        NewRegion: null,
        createdBy: user.id
      },
    });


    // Optionally revalidate the ID and services
    idService(validatedId);
    revalidateService(key);

    res.status(200).json({
      success: true,
      message: "Resource updated successfully",
      data: result,
    });

    // Notify the user about the event based on the notification type
    notification("assign", result, user)

    // Log an audit entry for tracking user actions
    await prismaClient.audit.create({
      data: {
        userId: user.id,
        ipAddress: req.ip,
        action: EventType.TRANSACTION,
        details: `User: ${user.email} has updated the transaction with ID: ${JSON.stringify(id)}. change value: ${JSON.stringify(data)}`,
        endpoint: '/transactions',
        source: SourceType.USER
      },
    });
  };


//-----------------------------------------------------------------------------
//             DELETE TRANSACTIONS : delete  /transactions/:id
//-----------------------------------------------------------------------------

// Handling delete process
export const remove =
  async (req: Request, res: Response, next: NextFunction) => {
    let id = req.params.id;

    if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

    id = idSchema.parse(id);

    await prismaClient.transaction.delete({
      where: { id: id },
    });
    await redis.del(id);
    revalidateService(key);

    res.status(204).send();

    const user = await getUserConnected(req);
    // Audit entry for tracking purpose
    await prismaClient.audit.create({
      data: {
        userId: user.id,
        ipAddress: req.ip,
        action: EventType.TRANSACTION,
        details: `User : ${user.email} has deleted Transaction : ${JSON.stringify(id)}`,
        endpoint: '/transactions',
        source: SourceType.USER
      },
    });
  };


//-----------------------------------------------------------------------------
//             SOFT-DELETE TRANSACTIONS : delete  /transactions/:id
//-----------------------------------------------------------------------------

// Handling delete process
export const softRemove =
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

    const request = await prismaClient.transaction.findUnique({
      where: { id: idSchema.parse(id) },
    });
    if (!request) throw new NotFoundException("ressource not found", ErrorCode.RESSOURCE_NOT_FOUND);

    // get the user information
    const user = await prismaClient.user.findFirst({
      where: { id: req.user?.id },
    });
    if (!user) throw new UnauthorizedException("Unauthorize ressource", ErrorCode.UNAUTHORIZED);


    await prismaClient.transaction.update({
      where: { id: id },
      data: {
        deleted: true,
        deletedBy: user.id,
        deletedAt: new Date(),
      },
    });

    await redis.del(id);
    revalidateService(key);

    res.status(204).send();

    // Audit entry for tracking purpose
    await prismaClient.audit.create({
      data: {
        userId: user.id,
        ipAddress: req.ip,
        action: EventType.TRANSACTION,
        details: `User : ${user.email} has deleted Transaction : ${JSON.stringify(id)}`,
        endpoint: '/transactions',
        source: SourceType.USER
      },
    });

  };


//-----------------------------------------------------------------------------
//             BULK-CREATE TRANSACTIONS : post /transactions/bluk
//-----------------------------------------------------------------------------

// IBulkCreateRequest interface definition
interface IBulkCreateRequest {
  data: { name: string }[];
}


// Handling create role process
export const bulkCreate =
  async (req: Request, res: Response, next: NextFunction) => {
    // Validate that the request body is an array
    const requests = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      throw new BadRequestException("Request body must be a non-empty array", ErrorCode.INVALID_DATA);
    }

    // const parsedData = bulkCreateSchema.parse(req.body as IBulkCreateRequest);
    // get the user information
    const user = await prismaClient.user.findFirst({
      where: { id: req.user?.id },
    });
    if (!user) throw new UnauthorizedException("Unauthorize ressource", ErrorCode.UNAUTHORIZED);



    const validRequests = [];
    // Validate each request
    for (const requestData of requests) {
      const { name, amount, bank, branch, mode, payment_date } = requestData;
      // Validate required fields for each request
      if (!name || !amount || !bank || !branch || !payment_date) {
        throw new BadRequestException("All fields (payment_date, name, amount, bank , branch) are required for each request", ErrorCode.INVALID_DATA);
      }

      const bankData = await prismaClient.bank.findFirst({
        where: { id: bank }
      });
      if (!bankData) throw new ConfigurationException("bankData not found, please contact adminstrator", ErrorCode.BAD_CONFIGURATION);

      const branchData = await prismaClient.bankAgency.findFirst({
        where: { id: branch }
      });
      if (!branchData) throw new ConfigurationException("Branch Data not found, please contact adminstrator", ErrorCode.BAD_CONFIGURATION);

      const payMode = await prismaClient.paymentMode.findFirst({
        where: { id: mode }
      });
      if (!payMode) throw new ConfigurationException("Payment mode not found, please contact adminstrator", ErrorCode.BAD_CONFIGURATION);


      // Generate a unique reference if it's not provided
      // const uniqueReference = await generateICNRef(parseDMY(payment_date));
      const data = transactionSchema.parse({
        // reference: uniqueReference.reference,
        name,
        amount,
        bankId: bankData.id,
        branchId: branchData.id,
        paymentDate: parseDMY(payment_date),
        paymentModeId: payMode.id,
        createdBy: user.id,
        modifiedBy: user.id,
        userId: user.id,
        statusId: 2

      })
      validRequests.push(data);
    }

    // Insert all valid requests into the database
    const createdRequests = await prismaClient.transaction.createMany({ data: validRequests });

    res.status(201).json({
      success: true,
      //data: createdRequests,
    });

  };


//---------------------------------------------------------
//            SOFT BULK DELETE REQUEST
//---------------------------------------------------------

// Handling soft delete process
export const bulkSoftRemove =
  async (req: Request, res: Response, next: NextFunction) => {

    let ids = req.body.ids; // Supposons que les IDs sont passés dans le corps de la requête

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Invalid params: IDs are required', ErrorCode.INVALID_DATA);
    }

    ids = ids.map((id: string) => idSchema.parse(id));

    // Vérifiez si les requêtes existent
    const requests = await prismaClient.transaction.findMany({
      where: { id: { in: ids } },
    });

    if (requests.length !== ids.length) {
      throw new NotFoundException('Invalid params: Some transactions not found', ErrorCode.INVALID_DATA);
    }

    // Supprimez les transactions en masse
    await prismaClient.transaction.deleteMany({
      where: { id: { in: ids } },
    });

    // Supprimez les entrées correspondantes du cache Redis
    await Promise.all(ids.map((item: string) => redis.del(item)));

    return res.status(200).json({
      success: true,
      message: "Transactions deleted successfully",
    });

  }


//-----------------------------------------------------------------------------
//             QUALITY CONTROLE :  /transactions/:id/quality
//-----------------------------------------------------------------------------

export const qualityAssurance =
  async (req: Request, res: Response, next: NextFunction) => {

    // Retrieve the transaction ID from request parameters
    const id = req.params.id;
    if (!id) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)

    // Retrieve the transaction type from request parameters
    const type: string = req.body.type?.toLowerCase() === "light" ? "light" : "full";

    // Fetch the transaction based on the provided ID
    const transaction = await prismaClient.transaction.findUnique({
      where: { id: id },
    });
    if (!transaction) throw new BadRequestException('Invalid params', ErrorCode.INVALID_DATA)


    // Check if the transaction status allows further action
    if (type === 'full' && transaction.statusId !== 6) {
      return res.status(200).json({
        success: true,
        quality_assurance: false,
        message: "No action available on this transaction",
      });
    }

    // Fetch the user making the request
    const user = await prismaClient.user.findFirst({
      where: { id: req.user?.id },
    });
    if (!user) throw new UnauthorizedException("UNAUTHORIZED", ErrorCode.UNAUTHORIZED);

    // Check if the transaction is locked by another user (only for "full" type)
    if (type === 'full') {
      const lock = await prismaClient.transactionTempUser.findFirst({ where: { transactionId: id } });
      if (lock && lock.userId !== user.id) {
        // Fetch the email of the user who has locked the transaction
        const lockUser = await prismaClient.user.findUnique({
          where: { id: lock.userId },
          select: { email: true },
        });
        return res.status(200).json({
          success: true,
          quality_assurance: false,
          message: `This transaction is currently being processed by another user. You cannot edit it until the user: ${lockUser?.email} completes their task.`,
        });
      }
    }

    // Fetch the selected invoices related to the transaction
    const invoices = await prismaClient.transactionDetail.findMany({
      where: { transactionId: id, selected: true },
    });

    // Calculate the total amount to be paid based on the selected invoices
    const newTotalToPaid = invoices.reduce((acc, cur) => acc + cur.amountTopaid, 0);
    if (newTotalToPaid !== transaction.amount) {
      return res.status(200).json({
        success: true,
        quality_assurance: false,
        message: "The amount you are attempting to pay does not match the amount specified in the ACI.",
      });
    }

    // Track duplicates using a Map for efficient lookup
    const invoiceMap = new Map<string, boolean>();
    const duplicates: string[] = [];

    // Check for duplicate invoices
    invoices.forEach(row => {
      const key = `${row.contract}-${row.invoice}`;
      if (invoiceMap.has(key)) {
        duplicates.push(`Bill: ${row.invoice}, Contract: ${row.contract}`);
      } else {
        invoiceMap.set(key, true);
      }
    });

    // If duplicates are found, return a message
    if (duplicates.length > 0) {
      return res.status(200).json({
        success: true,
        quality_assurance: false,
        message: `You have duplicate invoices: ${duplicates.join(', ')}`,
      });
    }

    // Raw SQL query to check for invoices already used in other transactions
    //   const result: any = await prismaClient.$queryRawUnsafe(`
    //     SELECT 
    //       td.invoice,
    //       td.transactionId,
    //       t.reference,
    //       t.statusId,
    //       COUNT(*) AS transaction_count
    //     FROM 
    //       transaction_details td
    //     JOIN 
    //       transactions t ON td.transactionId = t.id
    //     JOIN 
    //       (SELECT invoice FROM transaction_details WHERE transactionId = ? AND selected = 1) sub ON td.invoice = sub.invoice
    //     WHERE 
    //       td.transactionId <> ? AND t.statusId <> 6
    //     GROUP BY 
    //       td.invoice, td.transactionId, t.reference, t.statusId;
    // `, id, id);
    const result: any = await prismaClient.$queryRawUnsafe(`
    SELECT 
      td.invoice,
      td.transactionId,
      t.reference,
      t.statusId,
      COUNT(*) AS transaction_count
    FROM 
      transaction_details td
    JOIN 
      transactions t ON td.transactionId = t.id
    JOIN 
      (SELECT invoice FROM transaction_details WHERE transactionId = ? AND selected = 1) sub ON td.invoice = sub.invoice
    WHERE 
      td.transactionId <> ? 
      AND t.statusId <> 6 
      AND (t.statusId <> 9 OR td.invoice NOT IN (SELECT invoice FROM transaction_details WHERE transactionId = ?))
    GROUP BY 
      td.invoice, td.transactionId, t.reference, t.statusId;
  `, id, id, id);

    // If already used invoices are found, return a message
    if (result.length > 0) {
      const alreadyUsed = result.map((row: { invoice: any; reference: any; }) => `Bill: ${row.invoice} already used in ACI: ${row.reference}`).join(', ');
      return res.status(200).json({
        success: true,
        quality_assurance: false,
        message: `${alreadyUsed}`,
      });
    }

    // If all checks pass, return success
    return res.status(200).json({
      success: true,
      quality_assurance: true,
      message: 'ok',
    });

  };


//-----------------------------------------------------------------------------
//             UNICITY CONTROLE :  /transactions/unicity-assurance
//-----------------------------------------------------------------------------

export const unicityAssurance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input using the schema
    const parsedTransaction = unicitySchema.parse(req.body);

    // Clean the name by removing extra spaces and converting to lowercase
    const cleanedName = parsedTransaction.name.trim().replace(/\s+/g, '').toLowerCase();

    // Format the date from DD/MM/YYYY to YYYY-MM-DD
    const paymentDate = convertDateToDBFormat(parsedTransaction.payment_date);

    // Concatenate transaction details for uniqueness check
    // const transactionDetails = `${cleanedName}-${parsedTransaction.amount}-${parsedTransaction.bank}-${parsedTransaction.branch}-${parsedTransaction.payment_mode}-${paymentDate}`;
    const transactionDetails = `${parsedTransaction.amount}-${parsedTransaction.bank}-${parsedTransaction.branch}-${parsedTransaction.payment_mode}-${paymentDate}`;

    const count = await prismaClient.transaction.count({});
    if (count > 1) {
      // Query the view to check for uniqueness
      const transaction: any = await prismaClient.$queryRaw`
        SELECT * FROM v_transactions_unicity
        WHERE delta COLLATE utf8mb4_unicode_ci = ${transactionDetails};
      `;

      // Check if any transactions were found
      if (transaction.length > 0) {
        // format transactions informations
        const fromatedInformations = transaction.map((trans: { reference: string | null; amount: string; bank: string; branch: string; paymentDate: string; email: string; phone: string | null }) => {
          const referenceInfo = trans.reference ? `reference-[${trans.reference}]` : 'reference-[N/A]'; // Use 'N/A' if reference is null
          const phoneInfo = trans.phone ? `, / ${trans.phone}` : ''; // Only add phone if it exists
          return `Existing transaction ${referenceInfo}-amount-[${trans.amount}]-date-[${trans.paymentDate}]-bank-[${trans.bank} / ${trans.branch}]-initiateur-[${trans.email}${phoneInfo}]`;
        }).join(', ');

        return res.status(200).json({
          status: false,
          message: "Duplicate transactions were found:",
          transactions: fromatedInformations // Return the list of found transactions
        });
      }

    }

    // If no transactions are found, return an empty string
    res.status(200).json({
      status: true,
      message: "No duplicate transactions found.",
      transactions: "" // Return an empty string 
    });

  } catch (error) {
    // Error handling
    console.error(error);
    res.status(500).json({
      status: false,
      message: "An error occurred while checking transaction uniqueness.",
      transactions: "" // Return an empty string 
    });
  }
};


//-----------------------------------------------------------------------------
//             UNICITY CONTROLE :  /transactions/unicity-assurance/:id
//-----------------------------------------------------------------------------

export const unicityAssuranceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract necessary details from the request
    const { id } = req.params; // Assuming the ID is part of the request parameters

    // Fetch the transaction information by ID
    const parsedTransaction = await prismaClient.transaction.findUnique({
      where: { id: id },
      select: {
        name: true,
        amount: true,
        bankId: true,
        branchId: true,
        paymentModeId: true,
        paymentDate: true,
      }
    });

    // Check if the transaction was found
    if (!parsedTransaction) {
      // Handle case where transaction doesn't exist
      res.status(400).json({
        status: null,
        message: "Transaction not found..",
        transactions: "" // Return an empty string 
      });
    }

    // Clean the name by removing extra spaces and converting to lowercase
    const cleanedName = parsedTransaction?.name.trim().replace(/\s+/g, '').toLowerCase(); // Remove whitespace

    // Format payment date to 'yyyy-mm-dd'
    const paymentDate = parsedTransaction?.paymentDate
      ? parsedTransaction.paymentDate.toISOString().split('T')[0]  // Extract the date part
      : new Date().toISOString().split('T')[0]; // Use today's date if paymentDate is not available

    // Concatenate transaction details for uniqueness check
    // const transactionDetails = `${cleanedName}-${parsedTransaction?.amount}-${parsedTransaction?.bankId}-${parsedTransaction?.branchId}-${parsedTransaction?.paymentModeId}-${paymentDate}`;
    const transactionDetails = `${parsedTransaction?.amount}-${parsedTransaction?.bankId}-${parsedTransaction?.branchId}-${parsedTransaction?.paymentModeId}-${paymentDate}`;

    // Query the view to check for uniqueness
    const transaction: any = await prismaClient.$queryRaw`
      SELECT * FROM v_transactions_unicity
      WHERE delta COLLATE utf8mb4_unicode_ci = ${transactionDetails};
    `;

    // Check if any transactions were found
    if (transaction.length > 1) {
      // format transactions informations
      const fromatedInformations = transaction.map((trans: { reference: string | null; amount: string; bank: string; branch: string; statusId: number; email: string; paymentDate: string; phone: string | null }) => {
        const referenceInfo = trans.reference ? `reference-[${trans.reference}]` : 'reference-[N/A]'; // Use 'N/A' if reference is null
        const phoneInfo = trans.phone ? `, / ${trans.phone}` : ''; // Only add phone if it exists
        return `${trans.statusId == 2 ? "Current" : "Existing"} transaction ${referenceInfo}-amount-[${trans.amount}]-date-[${trans.paymentDate}]-bank-[${trans.bank} / [${trans.branch}]-initiateur-[${trans.email}${phoneInfo}]`;
      }).join(', ');

      return res.status(200).json({
        status: false,
        message: "Duplicate transactions were found:",
        transactions: fromatedInformations // Return the list of found transactions
      });
    }

    // If no transactions are found, return an empty string
    res.status(200).json({
      status: true,
      message: "No duplicate transactions found.",
      transactions: "" // Return an empty string 
    });

  } catch (error) {
    // Error handling
    console.error(error);
    res.status(500).json({
      status: null,
      message: "An error occurred while checking transaction uniqueness.",
      transactions: "" // Return an empty string 
    });
  }
};






const idService = async (id: string) => {

  // Query the database for the transaction
  // const data = await prismaClient.transaction.findUnique({
  //   where: { id: id },
  //   include: { bank: true, branch: true , paymentMode: true }
  // });
  const data: Transaction[] = await prismaClient.$queryRaw`
  SELECT * FROM v_transactions
  WHERE id = ${id};`;

  // Store the retrieved data in Redis for caching
  await redis.set(
    id,
    JSON.stringify(data[0]),
    "EX",
    REDIS_SESSION_EXPIRE
  );

  return data
}

const revalidateService = async (key: string) => {
  const data = await prismaClient.transaction.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
  await redis.set(key, JSON.stringify(data));
  return data
}

/**
 * The function `generateICNRef` generates a new reference based on the current date and the last
 * reference in the database collection.
 * @param {Date} date - The `generateICNRef` function is designed to generate a new reference based on
 * the provided date. It retrieves the last reference from a database collection, extracts the sequence
 * number from it, increments the sequence number, and creates a new reference using the current month
 * and year along with the updated sequence
 * @returns The `generateICNRef` function returns a new ICN reference number that is generated based on
 * the current date and the last reference number stored in the database. The function first retrieves
 * the last reference number from the database, then calculates a new reference number by incrementing
 * the sequence number part of the last reference number. If there is no last reference number found,
 * it generates a new reference number
 */
async function generateICNRef(date: Date, bankId: string) {

  // Get the bank's code using the bankId
  const bank = await prismaClient.bank.findUnique({
    where: { id: bankId },
    select: { code: true }
  });

  if (!bank || !bank.code) {
    throw new Error("Bank not found or bank code is missing.");
  }

  // Get last reference in the references database collection
  const lastReference = await prismaClient.reference.findFirst({
    where: {
      AND: [
        {
          reference: {
            startsWith: getCurrentMonthYear(date.toDateString()), // Filtrer par mois et année
          },
        },
        {
          reference: {
            endsWith: bank.code, // Filtrer par suffixe
          },
        },
      ],
    },
    orderBy: { createdAt: 'desc', }
  });

  let newReference: string;
  if (lastReference) {
    // Extract sequence number from last reference
    const lastSequenceNumber = parseInt(lastReference.reference.slice(4, -2)); // Exclude last 2 characters (bank code)
    newReference = `${getCurrentMonthYear(date.toDateString())}${String(lastSequenceNumber + 1).padStart(4, '0')}${bank.code}`;
  } else {
    // First reference
    newReference = `${getCurrentMonthYear(date.toDateString())}0001${bank.code}`;
  }

  return await prismaClient.reference.create({ data: { reference: newReference } });
}


/**
 * Sends notifications to users based on the type of event that occurred.
 *
 * This function handles various notification types such as publish, reject, validate, assign,
 * and verification. It communicates relevant information to the involved users via email.
 *
 * @param {notificationType} type - The type of notification to send (e.g., "publish", "validate", "reject").
 * @param {any} transaction - The transaction object containing relevant details like reference ID and creator information.
 * @param {any} user - The user associated with the transaction, used to determine the recipient of the notification.
 *
 * @returns void - A promise that resolves when notifications have been sent.
 */
async function notification(type: notificationType, transaction: any, user: any) {
  let createdBy;
  // Check the notification type
  switch (type) {
    case "publish":
      // Handle publish case Notified the user and notified all validator
      // user
      await prismaClient.notification.create({
        data: {
          email: user.email,
          message: `Your transaction ID : ${transaction.reference} has been published and is currently undergoing validation.`,
          method: NotificationMethod.EMAIL,
          subject: "New published transaction",
          template: "notification.mail.ejs",
        },
      });
      // validators
      const validadors = await getUsersWithRole();
      for (const validador of validadors) {
        await prismaClient.notification.create({
          data: {
            email: validador.email,
            message: `You have a new transaction that requires your attention for validation. Transaction ID: ${transaction.reference} Please review it at your earliest convenience.`,
            method: NotificationMethod.EMAIL,
            subject: " New Transaction Awaiting Your Validation",
            template: "notification.mail.ejs",
          },
        });
      }

      break;
    case "reject":
      // Handle reject case and notified the person who created the transactions
      createdBy = await prismaClient.user.findFirst({
        where: { id: transaction.createdBy }
      })
      if (createdBy) {
        await prismaClient.notification.create({
          data: {
            email: createdBy.email,
            message: `Your transaction ID: ${transaction.reference} has been rejected.`,
            method: NotificationMethod.EMAIL,
            subject: "Transaction Rejected",
            template: "notification.mail.ejs",
          },
        });
      }

      break;
    case "validate":
      // Handle validate case and notify the person who created the transaction and all assignators
      createdBy = await prismaClient.user.findFirst({
        where: { id: transaction.createdBy },
      });
      if (createdBy) {
        await prismaClient.notification.create({
          data: {
            email: createdBy.email,
            message: `Your transaction ID: ${transaction.reference} has been validated ,and is undergoing assignation process.`,
            method: NotificationMethod.EMAIL,
            subject: "Transaction Validated",
            template: "notification.mail.ejs",
          },
        });
      }
      // assignators
      const assignators = await getUsersWithRole('ASSIGNATOR');
      for (const assignator of assignators) {
        await prismaClient.notification.create({
          data: {
            email: assignator.email,
            message: `You have a new transaction that requires an assignation. Transaction ID: ${transaction.reference} Please review it at your earliest convenience.`,
            method: NotificationMethod.EMAIL,
            subject: " New Transaction Awaiting An Assignation",
            template: "notification.mail.ejs",
          },
        });
      }
      break;
    case "assign":
      // Handle assign case and notify the person who created the transaction
      // TODO
      // const assignCreator = await prismaClient.user.findFirst({
      //   where: { id: transaction.userId },
      // });
      // if (assignCreator) {
      //   await prismaClient.notification.create({
      //     data: {
      //       email: assignCreator.email,
      //       message: `Transaction ID: ${transaction.reference} has been assigned to you and need your commercial input.`,
      //       method: NotificationMethod.EMAIL,
      //       subject: "Transaction Assigned",
      //       template: "notification.mail.ejs",
      //     },
      //   });
      // }
      break;

    case "verifie":
      // Handle validate case and notify the person who created the transaction and all assignators
      const commercial = await prismaClient.user.findFirst({
        where: { id: transaction.userId },
      });
      if (commercial) {
        await prismaClient.notification.create({
          data: {
            email: commercial.email,
            message: `Your Transaction ID: ${transaction.reference} has been verified by the verifier and is now proceeding to payment. Please review it at your earliest convenience.`,
            method: NotificationMethod.EMAIL,
            subject: `Transaction ${transaction.reference} is verifie`,
            template: "notification.mail.ejs",
          },
        });
      }

      break;

    case "verifie-refusal":
      // Handle validate case and notify the person who created the transaction and all assignators
      if (transaction.userId) {
        const commercialReply = await prismaClient.user.findFirst({
          where: { id: transaction.userId },
        });
        const verifier = await prismaClient.user.findFirst({
          where: { id: transaction.verifierId },
        });
        if (commercialReply) {
          await prismaClient.notification.create({
            data: {
              email: commercialReply.email,
              message: `Your Transaction ID: ${transaction.reference} has been rejected by the verifier (${verifier?.email}) for the following reason: ${transaction.reasonForRefusal}. Please review the details and take the necessary actions to address any issues.`,
              method: NotificationMethod.EMAIL,
              subject: `[IMPORTANT]: Transaction ID: ${transaction.reference} - Rejected by Verifier Please Review`,
              template: "notification.mail.ejs",
            },
          });
        }
      }

      break;
    case "treat":
      // Handle treat case if needed
      break;
    default:
      console.log("Notification type", type) // TODO ajouter le cas in process (Personne a notifié ??)
    //throw new Error("Invalid notification type");
  }


}

type role = "VALIDATOR" | "ASSIGNATOR"
const getUsersWithRole = async (role: string = "VALIDATOR") => {
  const users = await prismaClient.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            name: role,
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
  return users;
};

