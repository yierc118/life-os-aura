// /lib/schema.ts
// Zod schemas and validation

import { z } from 'zod';

export const ExampleSchema = z.object({
  id: z.string(),
  name: z.string(),
});
