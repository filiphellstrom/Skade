import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getDatabase } from "@/db/client";
import { hamtaEllerSkapaProfil } from "@/db/queries/profil";
import type { Profil } from "@/db/types";

/**
 * Ger alla skärmar under Stack åtkomst till den (enda) profilen utan
 * prop-drilling genom hela navigationsträdet. Profilen laddas en gång i
 * app/_layout.tsx innan Stack:en monteras - se onboarding-gaten där - så
 * useProfil() kan förutsätta att profilen finns och har ett icke-tomt namn.
 */
interface ProfilContextValue {
  profil: Profil;
  /** Läser om profilen från databasen, t.ex. efter att namnet ändrats i inställningar. */
  uppdateraProfilFranDatabas: () => Promise<void>;
}

const ProfilContext = createContext<ProfilContextValue | null>(null);

export function ProfilProvider({
  initialProfil,
  children,
}: {
  initialProfil: Profil;
  children: ReactNode;
}) {
  const [profil, setProfil] = useState(initialProfil);

  const uppdateraProfilFranDatabas = useCallback(async () => {
    const db = await getDatabase();
    const senaste = await hamtaEllerSkapaProfil(db);
    setProfil(senaste);
  }, []);

  const value = useMemo(
    () => ({ profil, uppdateraProfilFranDatabas }),
    [profil, uppdateraProfilFranDatabas],
  );

  return (
    <ProfilContext.Provider value={value}>{children}</ProfilContext.Provider>
  );
}

export function useProfil(): ProfilContextValue {
  const ctx = useContext(ProfilContext);
  if (!ctx) {
    throw new Error(
      "useProfil() måste anropas inom en <ProfilProvider> (monteras i app/_layout.tsx).",
    );
  }
  return ctx;
}
