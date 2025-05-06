import { z } from 'zod';

const idSchema = z.string().uuid();

const createSchema = z.object({
  reference: z.string()
    .min(1, 'Referenceis required')
    .regex(/^\d{10}$/, 'Reference must contain exactly 10 digits'),
  unitId: z.string().uuid('UnitId is not available'),
});

const updateSchema = z.object({
  reference: z.string()
    .min(1, 'Referenceis required')
    .regex(/^\d{10}$/, 'Reference must contain exactly 10 digits')
    .optional(),
  unitId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});


const bulkCreateSchema = z.object({
  assignments: z.array(
    z.object({
      reference: z.string()
        .min(1, 'Referenceis required')
        .regex(/^\d{10}$/, 'Reference must contain exactly 10 digits'),
      unitId: z.string().uuid('UnitId is not available'),
    })
  )
});


// Define the schema for bulk delete requests
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, { message: "At least one ID must be provided." })
});



// Export the schemas
export { idSchema, createSchema, updateSchema, bulkDeleteSchema };