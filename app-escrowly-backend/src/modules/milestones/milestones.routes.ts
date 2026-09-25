import type { FastifyInstance, FastifyRequest } from "fastify";
import { MilestonesService } from "./milestones.service.js";

export async function milestonesRoutes(
  app: FastifyInstance,
  opts: { milestonesService: MilestonesService },
) {
  app.post(
    "/contracts/:id/milestones/:mid/fund",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      const { id, mid } = request.params as { id: string; mid: string };
      return opts.milestonesService.fund(id, mid, user.sub);
    },
  );

  app.post(
    "/contracts/:id/milestones/:mid/submit",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      const { id, mid } = request.params as { id: string; mid: string };
      return opts.milestonesService.submit(id, mid, user.sub);
    },
  );
}