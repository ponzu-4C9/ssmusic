import { redirect } from "next/navigation";

import { LibraryProvider } from "@/components/LibraryProvider";
import { PlayerProvider } from "@/components/PlayerProvider";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy に加えた多層防御。未認証ならログインへ。
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
  return (
    <LibraryProvider>
      <PlayerProvider>{children}</PlayerProvider>
    </LibraryProvider>
  );
}
