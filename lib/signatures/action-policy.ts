export type SignatureActionKey =
  | "view" | "edit" | "resend" | "remind" | "correct" | "cancel"
  | "duplicate" | "archive" | "restore" | "delete" | "history" | "advanced";

export function signatureActionPolicy(input: {
  status: string;
  operationallyHidden: boolean;
  sourceAvailable: boolean;
  deletionEligible: boolean;
}) {
  const active = ["sent", "viewed", "partially_signed"].includes(input.status);
  const actions: SignatureActionKey[] = [input.status === "draft" ? "edit" : "view"];
  if (active) actions.push("resend", "remind", "correct", "cancel");
  if (input.sourceAvailable) actions.push("duplicate");
  if (input.operationallyHidden) actions.push("restore");
  else if (["draft", "completed", "voided", "expired"].includes(input.status)) actions.push("archive");
  if (input.deletionEligible) actions.push("delete");
  if (input.status !== "draft") actions.push("history");
  if (input.status === "completed") actions.push("advanced");
  return Object.freeze([...new Set(actions)]);
}
