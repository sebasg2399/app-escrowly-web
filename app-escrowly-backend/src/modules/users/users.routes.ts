import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { UsersService } from "./users.service.js";
import { updateProfileSchema } from "./users.schemas.js";

export async function usersRoutes(
  app: FastifyInstance,
  opts: {
    usersService: UsersService;
  },
) {
  app.get(
    "/users/me",
    { preHandler: [(app as any).authenticate] },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      return opts.usersService.getProfile(user.sub);
    },
  );

  app.patch(
    "/users/me",
    { preHandler: [(app as any).authenticate] },
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
