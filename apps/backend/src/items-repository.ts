import { randomUUID } from "node:crypto";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export type Item = {
  itemId: string;
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
  disposalYear?: number;
  disposalMonth?: number;
};

export type CreateItemInput = {
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
};

export type UpdateItemInput = {
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
  purchasePrice: number;
  disposalYear?: number;
  disposalMonth?: number;
};

export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`);
    this.name = "ItemNotFoundError";
  }
}

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  throw new Error("TABLE_NAME environment variable is not set");
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function toItem(itemId: string, raw: Record<string, unknown>): Item | null {
  const name = raw.name;
  const purchaseYear = Number(raw.purchaseYear);
  const purchaseMonth = Number(raw.purchaseMonth);
  const purchasePrice = Number(raw.purchasePrice);
  if (
    typeof name !== "string" ||
    !Number.isFinite(purchaseYear) ||
    !Number.isFinite(purchaseMonth) ||
    !Number.isFinite(purchasePrice)
  ) {
    return null;
  }
  const item: Item = {
    itemId,
    name,
    purchaseYear,
    purchaseMonth,
    purchasePrice,
  };
  const disposalYear = Number(raw.disposalYear);
  const disposalMonth = Number(raw.disposalMonth);
  if (
    Number.isInteger(disposalYear) &&
    Number.isInteger(disposalMonth) &&
    disposalYear > 0 &&
    disposalMonth >= 1 &&
    disposalMonth <= 12
  ) {
    item.disposalYear = disposalYear;
    item.disposalMonth = disposalMonth;
  }
  return item;
}

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
    if (typeof itemId !== "string") continue;
    const item = toItem(itemId, raw);
    if (item) items.push(item);
  }
  return items;
}

export async function getItemForUser(
  userId: string,
  itemId: string,
): Promise<Item | null> {
  const result = await documentClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { userId, itemId },
    }),
  );
  const raw = result.Item;
  if (!raw) return null;
  return toItem(itemId, raw);
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

export async function updateItem(
  userId: string,
  itemId: string,
  input: UpdateItemInput,
): Promise<Item> {
  const hasDisposal =
    input.disposalYear !== undefined && input.disposalMonth !== undefined;

  const setExpressions = [
    "#name = :name",
    "purchaseYear = :purchaseYear",
    "purchaseMonth = :purchaseMonth",
    "purchasePrice = :purchasePrice",
  ];
  const expressionAttributeNames: Record<string, string> = { "#name": "name" };
  const expressionAttributeValues: Record<string, unknown> = {
    ":name": input.name,
    ":purchaseYear": input.purchaseYear,
    ":purchaseMonth": input.purchaseMonth,
    ":purchasePrice": input.purchasePrice,
  };

  let updateExpression: string;
  if (hasDisposal) {
    setExpressions.push(
      "disposalYear = :disposalYear",
      "disposalMonth = :disposalMonth",
    );
    expressionAttributeValues[":disposalYear"] = input.disposalYear;
    expressionAttributeValues[":disposalMonth"] = input.disposalMonth;
    updateExpression = `SET ${setExpressions.join(", ")}`;
  } else {
    updateExpression = `SET ${setExpressions.join(", ")} REMOVE disposalYear, disposalMonth`;
  }

  try {
    const result = await documentClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { userId, itemId },
        UpdateExpression: updateExpression,
        ConditionExpression: "attribute_exists(itemId)",
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      }),
    );
    const raw = result.Attributes;
    if (!raw) {
      throw new ItemNotFoundError(itemId);
    }
    const item = toItem(itemId, raw);
    if (!item) {
      throw new Error("Malformed item after update");
    }
    return item;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) {
      throw new ItemNotFoundError(itemId);
    }
    throw e;
  }
}

export async function deleteItem(
  userId: string,
  itemId: string,
): Promise<boolean> {
  const result = await documentClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { userId, itemId },
      ReturnValues: "ALL_OLD",
    }),
  );
  return result.Attributes !== undefined;
}
