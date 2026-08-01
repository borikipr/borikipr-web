import type {
  TranslationDatabase,
  TranslationQueryExecutor,
} from "@/lib/i18n/translations/repository";

const READ_QUERY_PATTERN = /^\s*SELECT\b/i;

export async function runTranslationReadOnlyInspection<Result>(
  database: TranslationDatabase,
  inspect: (database: TranslationDatabase) => Promise<Result>
) {
  return database.begin(async (transaction) => {
    await transaction.unsafe("SET TRANSACTION READ ONLY");
    const readOnlyExecutor: TranslationQueryExecutor = {
      unsafe(query, parameters = []) {
        if (!READ_QUERY_PATTERN.test(query)) {
          throw new Error("Translation dry-run permits SELECT queries only.");
        }
        return transaction.unsafe(query, parameters);
      },
    };
    const readOnlyDatabase: TranslationDatabase = {
      ...readOnlyExecutor,
      async begin() {
        throw new Error("Nested transactions are unavailable during dry-run.");
      },
    };
    return inspect(readOnlyDatabase);
  });
}
