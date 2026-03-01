import { Arbre } from "./arbre";
import { Log, LogLevel } from "./types/log";

export { Arbre } from "./arbre";
export type { Layer } from "./layer";
export { Stdout } from "./layer/stdout-layer";
export { Filter } from "./layer/filter-layer";
export { Json } from "./layer/json-layer";
export type { Log, LogLevel } from "./types/log";

interface LogOpts<Payload, Scope> {
  scope?: Scope;
  payload?: Payload;
}

async function dispatch<Payload, Scope>(
  log: Log<Payload, Scope>,
): Promise<void> {
  const instance = Arbre.get_instance();
  await instance.handleLog<Payload, Scope>(log);
}

function createHandleLog<Payload, Scope>(
  level: LogLevel,
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  const log: Log<Payload, Scope> = {
    timestamp: new Date(),
    level,
    message,
    ...(opts?.scope !== undefined && { scope: opts.scope }),
    ...(opts?.payload !== undefined && { payload: opts.payload }),
  };
  void dispatch(log);
  return log;
}

export function debug<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("debug", message, opts);
}

export function trace<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("trace", message, opts);
}

export function info<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("info", message, opts);
}

export function warn<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("warn", message, opts);
}

export function error<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("error", message, opts);
}

export function fatal<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("fatal", message, opts);
}
