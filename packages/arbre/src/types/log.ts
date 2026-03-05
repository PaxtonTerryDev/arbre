export type LogLevel = "debug" | "trace" | "info" | "warn" | "error" | "fatal";

export interface Log<Payload = object, Scope extends string = string> {
  timestamp: Date;
  level: LogLevel;
  message: string;
  scope?: Scope;
  payload?: Payload;
}
