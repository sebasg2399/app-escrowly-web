import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "./auth.service.js";
import { registerSchema, loginSchema } from "./auth.schemas.js";
import type { Env } from "../../config/env.js";
import zodToJsonSchema from "zod-to-json-schema";

export async function authRoutes(
  app: FastifyInstance,
  opts: {
    authService: AuthService;
    env: Env;
  },
) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/auth",
    secure: opts.env.NODE_ENV === "production",
    maxAge: opts.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  };

  app.post(
    "/auth/register",
    {
      schema: {
        body: zodToJsonSchema(registerSchema.shape.body),
        response: {
          201: {
            type: "object",
            properties: { accessToken: { type: "string" } },
            required: ["accessToken"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = registerSchema.safeParse(request);
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

      const { accessToken, cookieValue } = await opts.authService.register(parsed.data.body);
      reply.setCookie(opts.env.COOKIE_NAME, cookieValue, cookieOptions);
      reply.code(201);
      return { accessToken };
    },
  );

  app.post(
    "/auth/login",
    {
      schema: {
        body: zodToJsonSchema(loginSchema.shape.body),
        response: {
          200: {
            type: "object",
            properties: { accessToken: { type: "string" } },
            required: ["accessToken"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = loginSchema.safeParse(request);
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

      const { accessToken, cookieValue } = await opts.authService.login(parsed.data.body);
      reply.setCookie(opts.env.COOKIE_NAME, cookieValue, cookieOptions);
      return { accessToken };
    },
  );

  app.post(
    "/auth/logout",
    {
      preHandler: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          204: { type: "null", description: "No content" },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user as { jti: string };
      const session = await opts.authService.findSessionByAccessJti(user.jti);
      if (session) {
        await opts.authService.logout(session.id);
      }
      reply.clearCookie(opts.env.COOKIE_NAME, { path: "/auth" });
      reply.code(204);
    },
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: { accessToken: { type: "string" } },
            required: ["accessToken"],
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const cookies = (request as any).cookies as Record<string, string> | undefined;
      const cookie = cookies?.[opts.env.COOKIE_NAME];
      if (!cookie) {
        const err = new Error("Missing refresh token") as Error & {
          statusCode: number;
          code: string;
        };
        err.statusCode = 401;
        err.code = "UNAUTHORIZED";
        throw err;
      }

      const { accessToken, cookieValue } = await opts.authService.refresh(cookie);
      reply.setCookie(opts.env.COOKIE_NAME, cookieValue, cookieOptions);
      return { accessToken };
    },
  );
}
