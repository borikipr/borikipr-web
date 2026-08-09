import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Sql } from "postgres";

type Executor = Pick<PGlite, "query"> | Pick<Transaction, "query">;

const ISOLATED_DB_SYMBOL = Symbol.for("borikipr.isolated-signing-pglite");

function templateQuery(strings: TemplateStringsArray, values: readonly unknown[]) {
  let text = strings[0] ?? "";
  for (let index = 0; index < values.length; index += 1) {
    text += `$${index + 1}${strings[index + 1] ?? ""}`;
  }
  return { text, values: [...values] };
}

async function isolatedDatabase(databasePath: string) {
  const state = globalThis as typeof globalThis & {
    [ISOLATED_DB_SYMBOL]?: Promise<PGlite>;
  };
  state[ISOLATED_DB_SYMBOL] ??= import("@electric-sql/pglite").then(async ({ PGlite }) => {
    const database = new PGlite(databasePath);
    await database.waitReady;
    return database;
  });
  return state[ISOLATED_DB_SYMBOL];
}

function createExecutor(executor: () => Promise<Executor>) {
  const tagged = async <T extends readonly Record<string, unknown>[]>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<T> => {
    if (!Array.isArray(strings) || !("raw" in strings)) {
      throw new Error("signature_isolated_sql_fragment_unsupported");
    }
    const query = templateQuery(strings, values);
    const result = await (await executor()).query(query.text, query.values);
    return result.rows as unknown as T;
  };
  tagged.unsafe = async <T extends readonly Record<string, unknown>[]>(
    query: string,
    parameters: readonly unknown[] = []
  ): Promise<T> => {
    const result = await (await executor()).query(query, [...parameters]);
    return result.rows as unknown as T;
  };
  return tagged;
}

export function createIsolatedPGliteSql(databasePath: string): Sql {
  const root = createExecutor(() => isolatedDatabase(databasePath)) as
    ReturnType<typeof createExecutor> & {
      begin<T>(callback: (transaction: Sql) => Promise<T>): Promise<T>;
    };
  root.begin = async <T>(callback: (transaction: Sql) => Promise<T>) => {
    const database = await isolatedDatabase(databasePath);
    return database.transaction(async (transaction) => {
      const sql = createExecutor(async () => transaction) as unknown as Sql;
      return callback(sql);
    });
  };
  return root as unknown as Sql;
}
