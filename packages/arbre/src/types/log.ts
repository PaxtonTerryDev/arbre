export type LogLevel = "debug" | "trace" | "info" | "warn" | "error" | "fatal";

export interface Log<Payload = unknown, Scope = unknown> {
  timestamp: Date;
  level: LogLevel;
  message: string;
  scope?: Scope;
  payload?: Payload;
}
