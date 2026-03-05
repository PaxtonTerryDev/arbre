import { Log } from "../types/log";

export interface Layer<Payload = object, Scope extends string = string> {
  handle(
    log: Log<Payload, Scope>,
  ): Promise<Log<Payload, Scope> | null> | Log<Payload, Scope> | null;
}
