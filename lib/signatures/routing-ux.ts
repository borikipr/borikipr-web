export type SignatureRoutingParticipant = Readonly<{
  id: string;
  name: string;
  role: string;
  routingOrder: number | null;
  isBrokerFinalSigner: boolean;
  status?: string;
}>;

export function signatureRoutingModeLabel(mode: "parallel" | "sequential" | "grouped") {
  return mode === "parallel" ? "Firmar al mismo tiempo" : mode === "sequential" ? "Firmar en orden" : "Firmar por etapas";
}
export function buildSignatureRoutingStages(
  participants: readonly SignatureRoutingParticipant[],
  mode: "parallel" | "sequential" | "grouped"
) {
  if (mode === "parallel") return participants.length ? [{ order: 1, participants }] : [];
  const groups = new Map<number, SignatureRoutingParticipant[]>();
  participants.forEach((participant, index) => {
    const order = participant.routingOrder ?? (mode === "sequential" ? index + 1 : 1);
    groups.set(order, [...(groups.get(order) ?? []), participant]);
  });
  return [...groups.entries()].sort(([left], [right]) => left - right)
    .map(([order, stageParticipants]) => ({ order, participants: stageParticipants }));
}

export function currentSignatureRoutingStage(participants: readonly SignatureRoutingParticipant[]) {
  const pending = participants.filter((participant) => !["completed", "revoked", "expired", "declined"].includes(participant.status ?? ""));
  if (!pending.length) return [];
  const firstOrder = Math.min(...pending.map((participant) => participant.routingOrder ?? 1));
  return pending.filter((participant) => (participant.routingOrder ?? 1) === firstOrder);
}
