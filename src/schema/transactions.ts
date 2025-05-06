import { z } from 'zod';

const idSchema = z.string().uuid();

const createSchema = z.object({
  name: z.string()
    .min(1, 'Customer name is required')
    .max(100, { message: "Customer name Less than 100 caracters." }),
    //.regex(/^[a-zA-Z0-9\s\-\+\*\|\\_\#\&]+$/, { message: "The customer name can only contain letters, numbers, and spaces." }),
  amount: z.number().positive(),
  bank: z.string().uuid('Bank input format is not available'),
  branch: z.string().uuid('Bank Branch input format is not available'),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_mode: z.string().uuid('Payment mode input format is not available'),
  description:z.string().optional(),
  advice_duplication: z.boolean().optional()
});

const updateSchema = z.object({
  name: z.string()
    .min(1, 'Customer name is required')
    .max(100, { message: "Customer name Less than 100 caracters." })
    //.regex(/^[a-zA-Z0-9\s\-\+\*\|\\_\#\&]+$/, { message: "The transaction name can only contain letters, numbers, and spaces." })
    .optional(),
  amount: z.number().positive().optional(),
  bankId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  payment_mode: z.string().uuid().optional(),
  payment_date: z.date().optional(),
  status: z.number().optional(),
  description:z.string().optional(),
  advice_duplication: z.boolean().optional()
});



const transactionSchema = z.object({
  reference: z.string().optional(),
  userId: z.string().uuid(), // Assurez-vous que c'est un UUID
  name: z.string()
    .min(1, 'Bank name is required')
    .max(100, { message: "Bank name Less than 100 caracters." }),
    // .regex(/^[a-zA-Z0-9\s\-\+\*\|\\_\#\&]+$/, { message: "The transaction name can only contain letters, numbers, space , dot and minus" }),
  amount: z.number().positive(),
  bankId: z.string().uuid('Bank is required'),
  branchId: z.string().uuid('Bank branch is required'),
  paymentDate: z.date(),
  paymentModeId: z.string().uuid(),
  statusId: z.number(),
  validatorId: z.string().uuid().optional(),
  createdBy: z.string().optional(),
  modifiedBy: z.string().optional(),
  description:z.string().optional(),
  advice_duplication: z.boolean().optional()
});

const transactionbulkSchema = z.object({
  userId: z.string().uuid(), // Assurez-vous que c'est un UUID
  name: z.string()
    .min(1, 'Bank name is required')
    .max(100, { message: "Bank name Less than 100 caracters." }),
    //.regex(/^[a-zA-Z0-9\s\-\+\*\|\\_\#\&]+$/, { message: "The transaction name can only contain letters, numbers, and spaces." }),
  amount: z.number().positive(),
  bankId: z.string().uuid('Bank name is required'),
  branchId: z.string().uuid('Bank branch is required'),
  paymentDate: z.date(),
  description:z.string().optional(),
  advice_duplication: z.boolean().optional()
 // paymentModeId: z.string().uuid(),
});

// Define the schema for bulk create requests
// const bulkCreateSchema = z.array({
//   // data: z.object(transactionbulkSchema).min(1, { message: "At least one transaction must be provided." })
//   name: z.string(),
//   // .min(1, 'Bank name is required'),
//   // .max(100, { message: "Bank name Less than 100 caracters." })
//   // .regex(/^[a-zA-Z0-9\s]+$/, { message: "The transaction name can only contain letters, numbers, and spaces." }),
// amount: z.number().positive(),
// bankId: z.string().uuid('Bank name is required'),
// paymentDate: z.date(),
// });

// Define the schema for bulk delete requests
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, { message: "At least one ID must be provided." })
});


const unicitySchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  amount: z.number().positive(),
  bank: z.string().uuid('Bank input format is not available'),
  branch: z.string().uuid('Bank Branch input format is not available'),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_mode: z.string().uuid('Payment mode input format is not available'),
});


// Export the schemas
export { transactionSchema, idSchema, createSchema, bulkDeleteSchema  , unicitySchema};
