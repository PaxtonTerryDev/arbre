import { Layer } from ".";
import { Log } from "../types/log";

export class App<Payload extends object = object, Scope = unknown>
  implements Layer<Payload, Scope>
{
  constructor(private readonly app: string) {}

  handle(log: Log<Payload, Scope>): Log<Payload, Scope> {
    return {
      ...log,
      payload: { ...log.payload, app: this.app } as Payload,
    };
  }
}
