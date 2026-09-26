import type { FastifyInstance, FastifyRequest } from "fastify";
import { MilestonesService } from "./milestones.service.js";
import {
  errorEnvelopeSchema,
  fundResultSchema,
  milestoneSchema,
} from "../schemas/index.js";

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
        response: {
          200: fundResultSchema,
          400: errorEnvelopeSchema,
          401: errorEnvelopeSchema,
          403: errorEnvelopeSchema,
          404: errorEnvelopeSchema,
          409: errorEnvelopeSchema,
          502: errorEnvelopeSchema,
        },
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
        response: {
          200: milestoneSchema,
          400: errorEnvelopeSchema,
          401: errorEnvelopeSchema,
          403: errorEnvelopeSchema,
          404: errorEnvelopeSchema,
          409: errorEnvelopeSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      const { id, mid } = request.params as { id: string; mid: string };
      return opts.milestonesService.submit(id, mid, user.sub);
    },
  );

  app.post(
    "/contracts/:id/milestones/:mid/approve",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: milestoneSchema,
          400: errorEnvelopeSchema,
          401: errorEnvelopeSchema,
          403: errorEnvelopeSchema,
          404: errorEnvelopeSchema,
          409: errorEnvelopeSchema,
          502: errorEnvelopeSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      const { id, mid } = request.params as { id: string; mid: string };
      return opts.milestonesService.approve(id, mid, user.sub);
    },
  );
}
