// Krävs för att expo-sqlite ska fungera på webben (Sprint 4: webbversion,
// 2026-08-30) - SQLite-motorn på webben laddas som en .wasm-fil
// (wa-sqlite), och Metro bunthanterar inte .wasm som en tillgång som
// standard. Utan den här filen misslyckas `npx expo export -p web` med
// "Unable to resolve module ./wa-sqlite/wa-sqlite.wasm".
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

module.exports = config;
