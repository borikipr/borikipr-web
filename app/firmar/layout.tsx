import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./signature-fonts.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function SigningLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-slate-50 text-slate-950">{children}</main>;
}
