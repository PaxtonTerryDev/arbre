import { Arbre } from "./arbre";
import { Log, LogLevel } from "./types/log";

interface LogOpts<Payload, Scope> {
  scope?: Scope;
  payload?: Payload;
}

async function process<Scope, Payload>(
  log: Log<Scope, Payload>,
): Promise<void> {
  const instance = Arbre.get_instance();
  instance.handleLog<Scope, Payload>(log);
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
  process(log);
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
  return createHandleLog("debug", message, opts);
}

export function info<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("debug", message, opts);
}

export function warn<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("debug", message, opts);
}

export function error<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("debug", message, opts);
}

export function fatal<Payload, Scope>(
  message: string,
  opts?: LogOpts<Payload, Scope>,
): Log<Payload, Scope> {
  return createHandleLog("debug", message, opts);
}
