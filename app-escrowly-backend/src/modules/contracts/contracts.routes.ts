import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ContractsService } from "./contracts.service.js";
import { createContractSchema } from "./contracts.schemas.js";
import zodToJsonSchema from "zod-to-json-schema";
import {
  contractSchema,
  errorEnvelopeSchema,
} from "../schemas/index.js";

function buildValidationError(
  details: Record<string, string[]>,
): Error & {
  statusCode: number;
  code: string;
  details: Record<string, string[]>;
} {
  const err = new Error("Validation failed") as Error & {
    statusCode: number;
    code: string;
    details: Record<string, string[]>;
  };
  err.statusCode = 400;
  err.code = "VALIDATION_ERROR";
  err.details = details;
  return err;
}

function flattenValidationIssues(issues: { path: (string | number)[]; message: string }[]) {
  const details: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = issue.path.join(".").replace(/^body\./, "") || "body";
    if (!details[field]) details[field] = [];
    details[field].push(issue.message);
  }
  return details;
}

export async function contractsRoutes(
  app: FastifyInstance,
  opts: { contractsService: ContractsService },
) {
  app.post(
    "/contracts",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(createContractSchema.shape.body),
        response: {
          201: contractSchema,
          400: errorEnvelopeSchema,
          401: errorEnvelopeSchema,
          403: errorEnvelopeSchema,
          404: errorEnvelopeSchema,
          409: errorEnvelopeSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createContractSchema.safeParse(request);
      if (!parsed.success) {
        throw buildValidationError(flattenValidationIssues(parsed.error.issues));
      }
      const user = request.user as { sub: string };
      const contract = await opts.contractsService.create(user.sub, parsed.data.body);
      reply.code(201);
      return contract;
    },
  );

  app.get(
    "/contracts",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: "array", items: contractSchema },
          401: errorEnvelopeSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      return opts.contractsService.listForUser(user.sub);
    },
  );

  app.get(
    "/contracts/:id",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: contractSchema,
          401: errorEnvelopeSchema,
          403: errorEnvelopeSchema,
          404: errorEnvelopeSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      const { id } = request.params as { id: string };
      return opts.contractsService.getForUser(id, user.sub);
    },
  );
}