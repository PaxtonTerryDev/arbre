import type { Log } from "arbre"

export interface StorageAdapter {
  insert(log: Log): Promise<void>
  insertMany(logs: Log[]): Promise<void>
}
