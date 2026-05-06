import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export type Item = {
  itemId: string;
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
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
    if (
      typeof itemId !== "string" ||
      typeof name !== "string" ||
      !Number.isFinite(purchaseYear) ||
      !Number.isFinite(purchaseMonth)
    ) {
      continue;
    }
    items.push({ itemId, name, purchaseYear, purchaseMonth });
  }
  return items;
}
