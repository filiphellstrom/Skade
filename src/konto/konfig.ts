/**
 * Skades server (server/ i repot): inloggning nu, jaktlag, planer,
 * eftersök och chatt senare. Den egna historiken ligger kvar i telefonen.
 */
export const API_URL = process.env.EXPO_PUBLIC_SKADE_API ?? "https://api.skade.hellstrom.fyi";

/** Appens djuplänk-schema (app.json) – dit Google-inloggningen kommer tillbaka. */
export const APP_SCHEMA = "skade";
