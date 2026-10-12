import type { AuthSession, ProductSyncEvent } from "../admin/contracts";
import type { HouseData, ResidentTask, ShoppingItem } from "./ResidentModel";

export type CachedHouse = {
  version: number;
  data: HouseData;
  baseData: HouseData;
  pending: boolean;
  events: ProductSyncEvent[];
  savedAt: string;
};

export type SyncConflict = {
  key: string;
  label: string;
  local: ResidentTask | ShoppingItem | undefined;
  shared: ResidentTask | ShoppingItem | undefined;
};

const DB_NAME = "chega-de-briga-local";
const STORE = "households";
const SESSION_KEY = "__session__";

function database() {
  if (typeof indexedDB === "undefined") return Promise.resolve(undefined);
  return new Promise<IDBDatabase | undefined>((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
    request.onblocked = () => resolve(undefined);
  });
}

export async function readCachedHouse(id: string): Promise<CachedHouse | undefined> {
  const db = await database();
  if (!db) return undefined;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as CachedHouse | undefined);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function writeCachedHouse(id: string, value: CachedHouse) {
  const db = await database();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => db.close());
}

export async function removeCachedHouse(id: string) {
  const db = await database();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => db.close());
}

export async function clearCachedHouses() {
  const db = await database();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => db.close());
}

export async function readCachedSession(): Promise<AuthSession | undefined> {
  const db = await database();
  if (!db) return undefined;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(SESSION_KEY);
    request.onsuccess = () => resolve(request.result as AuthSession | undefined);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function writeCachedSession(value: AuthSession) {
  const db = await database();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, SESSION_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => db.close());
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function mergeRows<T extends { id: string }>(
  kind: "task" | "item",
  base: T[],
  local: T[],
  shared: T[],
  choices: Record<string, "local" | "shared">,
  conflicts: SyncConflict[],
) {
  const baseById = new Map(base.map((row) => [row.id, row]));
  const localById = new Map(local.map((row) => [row.id, row]));
  const sharedById = new Map(shared.map((row) => [row.id, row]));
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...sharedById.keys()]);
  const merged = new Map(sharedById);

  for (const id of ids) {
    const before = baseById.get(id);
    const mine = localById.get(id);
    const theirs = sharedById.get(id);
    const localChanged = !same(before, mine);
    const sharedChanged = !same(before, theirs);
    if (!localChanged) continue;

    const key = `${kind}:${id}`;
    if (sharedChanged && !same(mine, theirs)) {
      const value = mine ?? theirs ?? before;
      const label = kind === "task"
        ? String((value as ResidentTask | undefined)?.title ?? "Tarefa")
        : String((value as ShoppingItem | undefined)?.name ?? "Item");
      if (!conflicts.some((item) => item.key === key)) conflicts.push({ key, label, local: mine as SyncConflict["local"], shared: theirs as SyncConflict["shared"] });
      if (choices[key] !== "local") continue;
    }
    if (mine) merged.set(id, mine);
    else merged.delete(id);
  }
  return [...merged.values()];
}

export function mergeHouseData(
  base: HouseData,
  local: HouseData,
  shared: HouseData,
  choices: Record<string, "local" | "shared"> = {},
) {
  const conflicts: SyncConflict[] = [];
  const tasks = mergeRows("task", base.tasks, local.tasks, shared.tasks, choices, conflicts) as ResidentTask[];
  const items = mergeRows("item", base.items, local.items, shared.items, choices, conflicts) as ShoppingItem[];
  const baseIds = new Set(base.items.map((item) => item.id));
  const addedNames = new Set(local.items.filter((item) => !baseIds.has(item.id)).map((item) => item.name.trim().toLocaleLowerCase("pt-BR")));
  for (const name of addedNames) {
    const localAdded = local.items.find((item) => !baseIds.has(item.id) && item.name.trim().toLocaleLowerCase("pt-BR") === name);
    const sharedAdded = shared.items.find((item) => !baseIds.has(item.id) && item.name.trim().toLocaleLowerCase("pt-BR") === name && item.id !== localAdded?.id);
    if (!localAdded || !sharedAdded) continue;
    const key = `item-name:${name}`;
    const quantityConflict = Boolean(localAdded.quantity && sharedAdded.quantity && localAdded.quantity !== sharedAdded.quantity);
    if (quantityConflict && !conflicts.some((item) => item.key === key)) conflicts.push({ key, label: localAdded.name, local: localAdded, shared: sharedAdded });
    const chosen = choices[key] === "local" ? localAdded : sharedAdded;
    const quantity = quantityConflict ? chosen.quantity : sharedAdded.quantity || localAdded.quantity;
    const compacted = { ...chosen, id: sharedAdded.id, quantity, priority: localAdded.priority === "before" || sharedAdded.priority === "before" ? "before" as const : "next" as const };
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (items[index]!.name.trim().toLocaleLowerCase("pt-BR") === name) items.splice(index, 1);
    }
    items.push(compacted);
  }
  return {
    data: {
      ...shared,
      tasks,
      items,
    } satisfies HouseData,
    conflicts,
  };
}
