import { Hono } from "hono";
import type { Context } from "hono";
import type { LambdaEvent } from "hono/aws-lambda";
import {
  createItem,
  deleteItem,
  getItemForUser,
  ItemNotFoundError,
  listItemsByUser,
  updateItem,
} from "./items-repository.js";

type Bindings = {
  event: LambdaEvent;
};

export const app = new Hono<{ Bindings: Bindings }>();

function getUserSub(c: Context<{ Bindings: Bindings }>): string | undefined {
  const claims = (
    c.env?.event as
      | {
          requestContext?: {
            authorizer?: { jwt?: { claims?: Record<string, unknown> } };
          };
        }
      | undefined
  )?.requestContext?.authorizer?.jwt?.claims;
  return typeof claims?.sub === "string" ? claims.sub : undefined;
}

type ItemBody = {
  name?: unknown;
  purchaseYear?: unknown;
  purchaseMonth?: unknown;
  purchasePrice?: unknown;
  disposalYear?: unknown;
  disposalMonth?: unknown;
};

type ValidatedItemInput = {
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
  disposalYear?: number;
  disposalMonth?: number;
};

type ValidationResult = { ok: true; value: ValidatedItemInput } | { ok: false; message: string };

function validateItemBody(body: ItemBody, options: { allowDisposal: boolean }): ValidationResult {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const purchaseYear = Number(body.purchaseYear);
  const purchaseMonth = Number(body.purchaseMonth);
  const purchasePrice = Number(body.purchasePrice);

  if (
    name.length === 0 ||
    !Number.isInteger(purchaseYear) ||
    purchaseYear < 1900 ||
    purchaseYear > 9999 ||
    !Number.isInteger(purchaseMonth) ||
    purchaseMonth < 1 ||
    purchaseMonth > 12 ||
    !Number.isInteger(purchasePrice) ||
    purchasePrice < 0
  ) {
    return { ok: false, message: "Invalid input" };
  }

  const result: ValidatedItemInput = {
    name,
    purchaseYear,
    purchaseMonth,
    purchasePrice,
  };

  if (options.allowDisposal) {
    const hasDisposalYear = body.disposalYear !== undefined && body.disposalYear !== null;
    const hasDisposalMonth = body.disposalMonth !== undefined && body.disposalMonth !== null;
    if (hasDisposalYear !== hasDisposalMonth) {
      return {
        ok: false,
        message: "disposalYear and disposalMonth must be provided together",
      };
    }
    if (hasDisposalYear && hasDisposalMonth) {
      const disposalYear = Number(body.disposalYear);
      const disposalMonth = Number(body.disposalMonth);
      if (
        !Number.isInteger(disposalYear) ||
        disposalYear < 1900 ||
        disposalYear > 9999 ||
        !Number.isInteger(disposalMonth) ||
        disposalMonth < 1 ||
        disposalMonth > 12
      ) {
        return { ok: false, message: "Invalid disposal date" };
      }
      const purchaseYM = purchaseYear * 12 + purchaseMonth;
      const disposalYM = disposalYear * 12 + disposalMonth;
      if (disposalYM < purchaseYM) {
        return {
          ok: false,
          message: "Disposal date must be on or after purchase date",
        };
      }
      result.disposalYear = disposalYear;
      result.disposalMonth = disposalMonth;
    }
  }

  return { ok: true, value: result };
}

app.get("/api/items", async (c) => {
  const sub = getUserSub(c);
  if (!sub) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const items = await listItemsByUser(sub);
  items.sort((a, b) =>
    b.purchaseYear !== a.purchaseYear
      ? b.purchaseYear - a.purchaseYear
      : b.purchaseMonth - a.purchaseMonth,
  );

  return c.json({ items });
});

app.get("/api/items/:id", async (c) => {
  const sub = getUserSub(c);
  if (!sub) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const itemId = c.req.param("id");
  const item = await getItemForUser(sub, itemId);
  if (!item) {
    return c.json({ message: "Not found" }, 404);
  }

  return c.json({ item });
});

app.post("/api/items", async (c) => {
  const sub = getUserSub(c);
  if (!sub) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as ItemBody | null;
  if (!body) {
    return c.json({ message: "Invalid JSON" }, 400);
  }

  const validated = validateItemBody(body, { allowDisposal: false });
  if (!validated.ok) {
    return c.json({ message: validated.message }, 400);
  }

  const item = await createItem(sub, validated.value);
  return c.json({ item }, 200);
});

app.put("/api/items/:id", async (c) => {
  const sub = getUserSub(c);
  if (!sub) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const itemId = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as ItemBody | null;
  if (!body) {
    return c.json({ message: "Invalid JSON" }, 400);
  }

  const validated = validateItemBody(body, { allowDisposal: true });
  if (!validated.ok) {
    return c.json({ message: validated.message }, 400);
  }

  try {
    const item = await updateItem(sub, itemId, validated.value);
    return c.json({ item });
  } catch (e) {
    if (e instanceof ItemNotFoundError) {
      return c.json({ message: "Not found" }, 404);
    }
    throw e;
  }
});

app.delete("/api/items/:id", async (c) => {
  const sub = getUserSub(c);
  if (!sub) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const itemId = c.req.param("id");
  const deleted = await deleteItem(sub, itemId);
  if (!deleted) {
    return c.json({ message: "Not found" }, 404);
  }
  return c.body(null, 204);
});
