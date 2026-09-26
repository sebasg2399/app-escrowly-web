/**
 * Shared JSON Schema fragments for the escrow API's response shapes.
 *
 * Fastify serializes responses through `fast-json-stringify`, which only emits
 * properties declared in the schema. Any field the clients/tests read MUST be
 * declared here or it will silently disappear from the response.
 */

export const errorEnvelopeSchema = {
  type: "object",
  required: ["code", "message"],
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    details: {
      type: "object",
      additionalProperties: { type: "array", items: { type: "string" } },
    },
  },
} as const;

export const participantSchema = {
  type: "object",
  required: ["id", "email", "name"],
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" },
    name: { type: "string" },
  },
} as const;

export const milestoneStatusSchema = {
  type: "string",
  enum: ["pending", "funded", "in_review", "disputed", "approved", "paid"],
} as const;

export const contractStatusSchema = {
  type: "string",
  enum: ["draft", "active", "completed", "cancelled"],
} as const;

export const milestoneSchema = {
  type: "object",
  required: [
    "id",
    "contractId",
    "title",
    "amount",
    "currency",
    "status",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    contractId: { type: "string", format: "uuid" },
    title: { type: "string" },
    amount: { type: "integer", minimum: 0 },
    currency: { type: "string" },
    status: milestoneStatusSchema,
    stripePaymentIntentId: { type: ["string", "null"] },
    stripeTransferId: { type: ["string", "null"] },
    paidAt: { type: ["string", "null"], format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export const contractSchema = {
  type: "object",
  required: [
    "id",
    "clientId",
    "sellerId",
    "status",
    "createdAt",
    "updatedAt",
    "client",
    "seller",
    "milestones",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    clientId: { type: "string", format: "uuid" },
    sellerId: { type: "string", format: "uuid" },
    status: contractStatusSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    client: participantSchema,
    seller: participantSchema,
    milestones: { type: "array", items: milestoneSchema },
  },
} as const;

export const fundResultSchema = {
  type: "object",
  required: ["id", "clientSecret"],
  properties: {
    id: { type: "string", format: "uuid" },
    clientSecret: { type: "string" },
  },
} as const;

export const onboardingLinkSchema = {
  type: "object",
  required: ["url"],
  properties: {
    url: { type: "string", format: "uri" },
  },
} as const;

export const connectStatusSchema = {
  type: "object",
  required: [
    "hasAccount",
    "detailsSubmitted",
    "payoutsEnabled",
    "onboardingComplete",
  ],
  properties: {
    hasAccount: { type: "boolean" },
    detailsSubmitted: { type: "boolean" },
    payoutsEnabled: { type: "boolean" },
    onboardingComplete: { type: "boolean" },
  },
} as const;
