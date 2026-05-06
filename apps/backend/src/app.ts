import { Hono } from "hono";
import type { LambdaEvent } from "hono/aws-lambda";
import { listItemsByUser } from "./items-repository.js";

type Bindings = {
  event: LambdaEvent;
};

export const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/items", async (c) => {
  const claims = (
    c.env?.event as
      | {
          requestContext?: {
            authorizer?: { jwt?: { claims?: Record<string, unknown> } };
          };
        }
      | undefined
  )?.requestContext?.authorizer?.jwt?.claims;
  const sub = typeof claims?.sub === "string" ? claims.sub : undefined;
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
