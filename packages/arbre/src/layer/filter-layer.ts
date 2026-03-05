import { Layer } from ".";
import { Log, LogLevel } from "../types/log";

export class Filter<Payload, Scope extends string = string> implements Layer {
  private static readonly ORDER: LogLevel[] = [
    "debug",
    "trace",
    "info",
    "warn",
    "error",
    "fatal",
  ];

  constructor(private readonly minimum: LogLevel) {}

  handle(log: Log<Payload, Scope>): Log<Payload, Scope> | null {
    if (Filter.ORDER.indexOf(log.level) < Filter.ORDER.indexOf(this.minimum)) {
      return null;
    }
    return log;
  }
}
