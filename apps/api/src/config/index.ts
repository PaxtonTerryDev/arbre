export interface Config {
  env: "development" | "production" | "test"
  server: { port: number; host: string }
  database: { url: string }
}

export function loadConfig(): Config {
  return {
    env: (process.env.NODE_ENV as Config["env"]) ?? "development",
    server: {
      port: Number(process.env.PORT ?? 3000),
      host: process.env.HOST ?? "0.0.0.0",
    },
    database: {
      url: process.env.DATABASE_URL ?? "",
    },
  }
}
