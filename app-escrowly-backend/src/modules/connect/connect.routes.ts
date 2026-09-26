import type { FastifyInstance, FastifyRequest } from "fastify";
import { ConnectService } from "./connect.service.js";
import {
  connectStatusSchema,
  errorEnvelopeSchema,
  onboardingLinkSchema,
} from "../schemas/index.js";

export async function connectRoutes(
  app: FastifyInstance,
  opts: { connectService: ConnectService },
) {
  app.post(
    "/connect/onboarding-link",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: onboardingLinkSchema,
          401: errorEnvelopeSchema,
          403: errorEnvelopeSchema,
          404: errorEnvelopeSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      return opts.connectService.createOnboardingLink(user.sub);
    },
  );

  app.get(
    "/connect/status",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: connectStatusSchema,
          401: errorEnvelopeSchema,
        },
      },
    },
    async (request: FastifyRequest) => {
      const user = request.user as { sub: string };
      return opts.connectService.getStatus(user.sub);
    },
  );
}
