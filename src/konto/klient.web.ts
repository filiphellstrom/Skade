import { createAuthClient } from "better-auth/react";
import { API_URL } from "./konfig";

/**
 * Inloggningsklienten på webben. Sessionen är en kaka som servern sätter;
 * den måste skickas med även fast servern ligger på en annan underdomän.
 */
export const kontoKlient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: { credentials: "include" },
});
