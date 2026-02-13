import { Layer } from ".";
import { Log } from "../types/log";

export class Stdout<Payload, Scope> implements Layer<Payload, Scope> {
  private format(log: Log<Payload, Scope>): string {
    return `${log.timestamp.toLocaleString()} [${log.level}]${log.scope ? ` [${log.scope}] ` : " "}${log.message}`;
  }

  handle(log: Log<Payload, Scope>): Log<Payload, Scope> {
    console.log(this.format(log));
    return log;
  }
}
