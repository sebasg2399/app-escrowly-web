import { http, HttpResponse } from "msw";

const VALID_TOKEN = "test-access-token";

const profileData = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  name: "Test User",
  role: "client" as const,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

// ----- Contracts mock state --------------------------------------------------
//
// Mirrors the contract + milestone domain from openspec/specs/contracts and
// openspec/specs/milestones. The OpenAPI spec at
// app-escrowly-backend/openapi.yaml does not currently declare response
// schemas for /contracts*, so the MSW shapes below are the local source of
// truth for the frontend until the backend adds response schemas.

export const clientUser = {
  id: profileData.id,
  email: profileData.email,
  name: profileData.name,
};

export const sellerUser = {
  id: "7b9e2c44-1c8e-4e0e-8b7a-3b6a2c0d1e01",
  email: "seller@example.com",
  name: "Test Seller",
};

export interface Milestone {
  id: string;
  title: string;
  /** Integer cents — never floats. */
  amount: number;
  status: "pending" | "funded" | "in_review" | "disputed" | "approved" | "paid";
}

export interface Contract {
  id: string;
  status: "draft" | "active" | "completed" | "cancelled";
  client: typeof clientUser;
  seller: typeof sellerUser;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

const seedContracts: Contract[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    status: "draft",
    client: clientUser,
    seller: sellerUser,
    milestones: [
      {
        id: "22222222-2222-4222-8222-222222222201",
        title: "Initial mockups",
        amount: 25000,
        status: "pending",
      },
      {
        id: "22222222-2222-4222-8222-222222222202",
        title: "Final deliverables",
        amount: 75000,
        status: "pending",
      },
    ],
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: "2024-02-01T00:00:00.000Z",
  },
];

// In-memory store mutated by POST /contracts. Tests can call `__resetContracts`
// via `server.use(...)` to substitute a fresh array.
let contracts: Contract[] = seedContracts.slice();

export function __resetContracts(next?: Contract[]) {
  contracts = next ? next.slice() : seedContracts.slice();
}

// ---------------------------------------------------------------------------

export const handlers = [
  http.get("/health", () => {
    return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  }),

  http.post("/auth/register", async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    if (body.email === "exists@example.com") {
      return HttpResponse.json(
        { code: "CONFLICT", message: "Email already exists" },
        { status: 409 },
      );
    }
    return HttpResponse.json({ accessToken: VALID_TOKEN }, { status: 201 });
  }),

  http.post("/auth/login", async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    if (body.email !== "user@example.com" || body.password !== "Correct1") {
      return HttpResponse.json(
        { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        { status: 401 },
      );
    }
    return HttpResponse.json({ accessToken: VALID_TOKEN });
  }),

  http.post("/auth/logout", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/auth/refresh", () => {
    return HttpResponse.json({ accessToken: VALID_TOKEN });
  }),

  http.get("/users/me", ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 },
      );
    }
    return HttpResponse.json(profileData);
  }),

  http.patch("/users/me", async ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 },
      );
    }
    const body = (await request.json()) as Record<string, string>;
    if (!body.name || body.name.length === 0) {
      return HttpResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { name: ["Name is required"] },
        },
        { status: 400 },
      );
    }
    if (body.name.length > 100) {
      return HttpResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { name: ["Name is too long"] },
        },
        { status: 400 },
      );
    }
    profileData.name = body.name;
    return HttpResponse.json({ ...profileData, updatedAt: new Date().toISOString() });
  }),

  // ----- /contracts* --------------------------------------------------------

  http.get("/contracts", ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 },
      );
    }
    // Backend is expected to scope to the caller's participant contracts.
    return HttpResponse.json(contracts);
  }),

  http.post("/contracts", async ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 },
      );
    }
    const body = (await request.json()) as {
      sellerEmail: string;
      milestones: { title: string; amount: number }[];
    };
    if (!body || !body.sellerEmail || !body.milestones || body.milestones.length === 0) {
      return HttpResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: {
            milestones: ["At least one milestone is required"],
          },
        },
        { status: 400 },
      );
    }
    // The backend treats an unknown seller email as 404 NOT_FOUND.
    if (body.sellerEmail !== sellerUser.email) {
      return HttpResponse.json(
        {
          code: "NOT_FOUND",
          message: "Seller account not found",
        },
        { status: 404 },
      );
    }
    const now = new Date().toISOString();
    const created: Contract = {
      id: crypto.randomUUID(),
      status: "draft",
      client: clientUser,
      seller: sellerUser,
      milestones: body.milestones.map((m) => ({
        id: crypto.randomUUID(),
        title: m.title,
        amount: m.amount,
        status: "pending",
      })),
      createdAt: now,
      updatedAt: now,
    };
    contracts = [...contracts, created];
    return HttpResponse.json(created, { status: 200 });
  }),

  http.get("/contracts/:id", ({ request, params }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return HttpResponse.json(
        { code: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 },
      );
    }
    const id = params.id as string;
    const found = contracts.find((c) => c.id === id);
    if (!found) {
      return HttpResponse.json(
        { code: "NOT_FOUND", message: "Contract not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json(found);
  }),
];
