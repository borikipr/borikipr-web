import { notFound } from "next/navigation";
import SignerInvitationLanding from "@/components/signatures/SignerInvitationLanding";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";

export const dynamic = "force-dynamic";

export default function SigningInvitationLanding() {
  if (!isSignerRuntimeEnabled()) notFound();
  return <SignerInvitationLanding />;
}
