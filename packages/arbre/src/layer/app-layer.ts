import { Layer } from ".";
import { Log } from "../types/log";

export class App implements Layer {
  constructor(private readonly app: string) {}

  handle(log: Log): Log {
    return {
      ...log,
      payload: { ...log.payload, app: this.app },
    };
  }
}
