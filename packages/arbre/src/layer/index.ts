import { Log } from "../types/log";

export interface Layer<Payload = unknown, Scope = unknown> {
  handle(
    log: Log<Payload, Scope>,
  ): Promise<Log<Payload, Scope> | null> | Log<Payload, Scope> | null;
}
