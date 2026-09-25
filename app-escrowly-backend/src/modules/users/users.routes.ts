import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { UsersService } from "./users.service.js";
import { updateProfileSchema } from "./users.schemas.js";
import zodToJsonSchema from "zod-to-json-schema";

export async function usersRoutes(
  app: FastifyInstance,
  opts: {
    usersService: UsersService;
  },
) {
  app.get(
    "/users/me",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              name: { type: "string" },
              role: { type: "string", enum: ["client", "seller", "admin"] },
              stripeCustomerId: { type: "string", nullable: true },
              stripeAccountId: { type: "string", nullable: true },
              subscriptionStatus: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            required: ["id", "email", "name", "role", "createdAt", "updatedAt"],
          },
        },
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      return opts.usersService.getProfile(user.sub);
    },
  );

  app.patch(
    "/users/me",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        body: {
          ...zodToJsonSchema(updateProfileSchema.shape.body),
          additionalProperties: true, // allow forbidden-field check to see raw body
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              name: { type: "string" },
              role: { type: "string", enum: ["client", "seller", "admin"] },
              stripeCustomerId: { type: "string", nullable: true },
              stripeAccountId: { type: "string", nullable: true },
              subscriptionStatus: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            required: ["id", "email", "name", "role", "createdAt", "updatedAt"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = updateProfileSchema.safeParse(request);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path.join(".").replace(/^body\./, "") || "body";
          if (!details[field]) details[field] = [];
          details[field].push(issue.message);
        }
        const err = new Error("Validation failed") as Error & {
          statusCode: number;
          code: string;
          details: Record<string, string[]>;
        };
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        err.details = details;
        throw err;
      }

      const user = request.user as { sub: string };
      const rawBody = (request.body as Record<string, unknown>) ?? {};
      const updated = await opts.usersService.updateProfile(user.sub, parsed.data.body, rawBody);
      const { passwordHash: _, ...safe } = updated;
      reply.code(200);
      return safe;
    },
  );
}
