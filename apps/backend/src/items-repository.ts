import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

export type Item = {
  itemId: string;
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
};

export type CreateItemInput = {
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
};

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error("TABLE_NAME environment variable is not set");
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function listItemsByUser(userId: string): Promise<Item[]> {
  const result = await documentClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
    }),
  );

  const items: Item[] = [];
  for (const raw of result.Items ?? []) {
    const itemId = raw.itemId;
    const name = raw.name;
    const purchaseYear = Number(raw.purchaseYear);
    const purchaseMonth = Number(raw.purchaseMonth);
    const purchasePrice = Number(raw.purchasePrice);
    if (
      typeof itemId !== "string" ||
      typeof name !== "string" ||
      !Number.isFinite(purchaseYear) ||
      !Number.isFinite(purchaseMonth) ||
      !Number.isFinite(purchasePrice)
    ) {
      continue;
    }
    items.push({ itemId, name, purchaseYear, purchaseMonth, purchasePrice });
  }
  return items;
}

export async function createItem(
  userId: string,
  input: CreateItemInput,
): Promise<Item> {
  const itemId = randomUUID();
  const item: Item = { itemId, ...input };
  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: { userId, ...item },
    }),
  );
  return item;
}
