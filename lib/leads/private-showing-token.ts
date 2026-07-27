import { randomBytes } from "crypto";

export function generatePrivateShowingToken() {
  return randomBytes(32).toString("base64url");
}
