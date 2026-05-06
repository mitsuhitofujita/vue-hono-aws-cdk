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
  { itemId: "i3", name: "洗濯機", purchaseYear: 2025, purchaseMonth: 8 },
  { itemId: "i4", name: "電子レンジ", purchaseYear: 2025, purchaseMonth: 5 },
  { itemId: "i5", name: "掃除機", purchaseYear: 2024, purchaseMonth: 12 },
  { itemId: "i6", name: "テレビ", purchaseYear: 2024, purchaseMonth: 7 },
  { itemId: "i7", name: "炊飯器", purchaseYear: 2024, purchaseMonth: 3 },
  { itemId: "i8", name: "ドライヤー", purchaseYear: 2023, purchaseMonth: 10 },
];

export const app = new Hono();

app.get("/api/items", (c) => c.json({ items: dummyItems }));
