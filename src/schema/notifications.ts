import { NotificationMethod } from '@prisma/client';
import { z } from 'zod';

const notificationSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  method: z.enum([NotificationMethod.EMAIL, NotificationMethod.WHATSAPP, NotificationMethod.INTERN, NotificationMethod.AVAILABLE]),
  subject: z.string().min(1),
  message: z.string().min(1),
  template: z.string().min(1),
});

const idSchema = z.number();


// Export the schemas
export { notificationSchema,idSchema };
