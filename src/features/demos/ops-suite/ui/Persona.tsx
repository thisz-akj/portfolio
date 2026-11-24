"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPersonaAction } from "../data/actions";
import { ROLE_LABEL, type Role } from "../auth/permissions";

interface PersonaInfo {
  id: number;
  name: string;
  role: Role;
}

const Ctx = createContext<PersonaInfo>({ id: 0, name: "Demo Admin", role: "admin" });
export const usePersona = () => useContext(Ctx);

export function PersonaProvider({ persona, children }: { persona: PersonaInfo; children: React.ReactNode }) {
  return <Ctx.Provider value={persona}>{children}</Ctx.Provider>;
}

/** Top-bar persona switcher — changes permissions and who changes are attributed to. */
export function PersonaSwitcher({ personas }: { personas: PersonaInfo[] }) {
  const current = usePersona();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!personas.length) return null;
  return (
    <label className="ops-persona">
      <span className="ops-sr">Acting as</span>
      <select
        value={current.id}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const res = await setPersonaAction(Number(e.target.value));
            if (res.ok) router.refresh();
          })
        }
      >
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {ROLE_LABEL[p.role]}
          </option>
        ))}
      </select>
    </label>
  );
}
