import type { Sql, TransactionSql } from "postgres";
import type {
  SignatureDatabase,
  SignatureQueryExecutor,
} from "./types";

export function createPostgresSignatureDatabase(database: Sql): SignatureDatabase {
  const executor = (
    source: Sql | TransactionSql
  ): SignatureQueryExecutor => ({
    unsafe: (query, parameters = []) =>
      source.unsafe(query, parameters as never[]),
  });

  return {
    ...executor(database),
    begin: async (callback) => {
      const result = await database.begin(async (transaction) => ({
        value: await callback(executor(transaction)),
      }));
      return result.value;
    },
  };
}
