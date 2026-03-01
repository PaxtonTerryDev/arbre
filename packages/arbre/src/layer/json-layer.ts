import { Layer } from ".";
import { Log } from "../types/log";

export class Json<Payload, Scope> implements Layer<Payload, Scope> {
  handle(log: Log<Payload, Scope>): Log<Payload, Scope> {
    console.log(JSON.stringify({ ...log, timestamp: log.timestamp.toISOString() }));
    return log;
  }
}
