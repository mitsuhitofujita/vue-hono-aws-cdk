import { fetchAuthSession } from "aws-amplify/auth";

export interface Item {
  itemId: string;
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
  disposalYear?: number;
  disposalMonth?: number;
}

export interface CreateItemInput {
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
}

export interface UpdateItemInput {
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
  disposalYear?: number;
  disposalMonth?: number;
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { tokens } = await fetchAuthSession();
  const idToken = tokens?.idToken?.toString();
  if (!idToken) throw new ApiError("Not authenticated", 401);
  return { Authorization: `Bearer ${idToken}` };
}

export async function fetchItems(): Promise<Item[]> {
  const headers = await authHeader();
  const res = await fetch("/api/items", { headers });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  const body = (await res.json()) as { items?: Item[] };
  if (!body || !Array.isArray(body.items)) {
    throw new ApiError("Malformed response");
  }
  return body.items;
}

export async function fetchItem(itemId: string): Promise<Item> {
  const headers = await authHeader();
  const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`, {
    headers,
  });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  const body = (await res.json()) as { item?: Item };
  if (!body || !body.item || typeof body.item.itemId !== "string") {
    throw new ApiError("Malformed response");
  }
  return body.item;
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const headers = {
    ...(await authHeader()),
    "Content-Type": "application/json",
  };
  const res = await fetch("/api/items", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  const body = (await res.json()) as { item?: Item };
  if (!body || !body.item || typeof body.item.itemId !== "string") {
    throw new ApiError("Malformed response");
  }
  return body.item;
}

export async function updateItem(itemId: string, input: UpdateItemInput): Promise<Item> {
  const headers = {
    ...(await authHeader()),
    "Content-Type": "application/json",
  };
  const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  const body = (await res.json()) as { item?: Item };
  if (!body || !body.item || typeof body.item.itemId !== "string") {
    throw new ApiError("Malformed response");
  }
  return body.item;
}

export async function deleteItem(itemId: string): Promise<void> {
  const headers = await authHeader();
  const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
}
