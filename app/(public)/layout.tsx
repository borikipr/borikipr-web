import type { ReactNode } from "react";
import Footer from "@/components/footer";
import PublicLocaleProvider from "@/components/PublicLocaleProvider";
import { isMultilingualEnabled } from "@/lib/i18n/locales";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const multilingualEnabled = isMultilingualEnabled();

  return (
    <PublicLocaleProvider multilingualEnabled={multilingualEnabled}>
      {children}
      <Footer />
    </PublicLocaleProvider>
  );
}
