import { Hono } from "hono";

type Item = {
  itemId: string;
  name: string;
  purchaseYear: number;
  purchaseMonth: number;
};

const dummyItems: Item[] = [
  { itemId: "i1", name: "エアコン", purchaseYear: 2026, purchaseMonth: 3 },
  { itemId: "i2", name: "冷蔵庫", purchaseYear: 2025, purchaseMonth: 11 },
  { itemId: "i3", name: "洗濯機", purchaseYear: 2024, purchaseMonth: 6 },
];

export const app = new Hono();

app.get("/api/items", (c) => c.json({ items: dummyItems }));
