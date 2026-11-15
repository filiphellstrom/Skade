import { kontoKlient } from "@/konto/klient";

/** Den inloggade användaren, eller null. vantar = sessionen har inte lästs in än. */
export function useJag(): { jag: { id: string; namn: string } | null; vantar: boolean } {
  const { data, isPending } = kontoKlient.useSession();
  const u = data?.user;
  return { jag: u ? { id: u.id, namn: u.name || "Namnlös" } : null, vantar: isPending };
}
