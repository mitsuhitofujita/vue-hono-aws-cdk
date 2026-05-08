import { Hono } from "hono";
import type { Context } from "hono";
import type { LambdaEvent } from "hono/aws-lambda";
import { createItem, listItemsByUser } from "./items-repository.js";

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

app.post("/api/items", async (c) => {
  const sub = getUserSub(c);
  if (!sub) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as
    | {
        name?: unknown;
        purchaseYear?: unknown;
        purchaseMonth?: unknown;
        purchasePrice?: unknown;
      }
    | null;
  if (!body) {
    return c.json({ message: "Invalid JSON" }, 400);
  }

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
    return c.json({ message: "Invalid input" }, 400);
  }

  const item = await createItem(sub, {
    name,
    purchaseYear,
    purchaseMonth,
    purchasePrice,
  });
  return c.json({ item }, 200);
});
