import { Layer } from ".";
import { Log } from "../types/log";

// FIX: Not sure if we should be enforcing that an endpoint be defined here.

export class Json<Payload, Scope extends string = string> implements Layer<
  Payload,
  Scope
> {
  handle(log: Log<Payload, Scope>): Log<Payload, Scope> {
    console.log(
      JSON.stringify({ ...log, timestamp: log.timestamp.toISOString() }),
    );
    return log;
  }
}
