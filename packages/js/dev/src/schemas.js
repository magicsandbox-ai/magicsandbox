const minimumMinCost = 0.001;

import { z } from "zod";

//be very careful with IndexedDB keys if allowing these characters in names: ~|{
const functionNameSchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
  .transform((s) => s.charAt(0).toLowerCase() + s.slice(1));
const appNameSchema = z
  .string()
  .max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
  .transform((s) => s.charAt(0).toUpperCase() + s.slice(1));

const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

const sharedSchema = z
  .object({
    id: z.string(),
    author: z.string(),
    version: versionSchema,
    description: z.string().optional(),
    minCost: z.number().gte(minimumMinCost).default(minimumMinCost),
    private: z.boolean().default(false),
  })
  .strict();

const functionSchema = sharedSchema.extend({
  name: functionNameSchema,
  kind: z.literal("function"),
  type: z.enum(["findApp"]).optional(),
  endpoint: z
    .string()
    .url()
    .refine(
      (val) =>
        !val ||
        val.startsWith("https://") ||
        val.startsWith("http://localhost:"),
      {
        message: "Endpoint must start with 'https'",
      },
    ),
  documentation: z.string().optional(),
  decode: z.enum(["json", "string", "bytes"]).default("json"),
  stream: z.boolean().default(false),
  subscribeToUpdates: z.boolean().default(false),
  status: z.enum(["active", "deprecated", "inactive"]).default("active"),
});

const appSchema = sharedSchema
  .extend({
    name: appNameSchema,
    kind: z.literal("app"),
    type: z.enum(["assistant"]).optional(),
    finalCost: z.number().gte(minimumMinCost).optional(),
    status: z.enum(["active", "deprecated"]).default("active"),
  })
  .transform((appObj) => ({
    ...appObj,
    finalCost: appObj.finalCost || appObj.minCost,
  }))
  .refine((data) => data.finalCost <= data.minCost, {
    message: "finalCost must be less than or equal to minCost",
    path: ["finalCost"], // This will make the error show up on the finalCost field
  });

export {
  functionNameSchema,
  appNameSchema,
  versionSchema,
  functionSchema,
  appSchema,
};
