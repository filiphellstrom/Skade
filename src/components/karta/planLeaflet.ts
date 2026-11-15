import L from "leaflet";
import { KART_FARGER } from "@/theme/tokens";
import { arPass, kategoriNamn } from "@/vind/gpx";
import type { PlanInnehall, PlanJaktmark, Punkt, Ruttpunkt, Uppdrag } from "@/jaktlag/typer";
import { punktFarg } from "./punktfarg";

/**
 * Ritar en jaktplan på en Leaflet-karta. Används av Karta-fliken på
 * webben (läsläge) och av planeraren (redigering). Bara för webben.
 *
 * Regeln för att kartan inte ska bli plottrig: uppdraget i fokus ritas
 * fullt ut (släpplats, rutt, start, mål, viktiga punkter). Övriga visas
 * bara som en liten märkt släpplats, och deras rutter som tunna streckade
 * linjer först när visaAllaRutter är på.
 *
 * Symboler: S = släpplats, A = start, B = mål, ! = viktig punkt.
 * Namn och texter sätts som ren text (textContent), aldrig som HTML.
 */

export interface PlanRitval {
  /** Uppdraget som ritas fullt ut. null = alla ritas som "övriga". */
  fokusId: string | null;
  visaAllaRutter: boolean;
  /** Redigering: markörerna för uppdraget i fokus går att dra. */
  redigera?: {
    onFlyttaSlapp: (uppdragId: string, p: Punkt) => void;
    onFlyttaRuttpunkt: (uppdragId: string, punktId: string, p: Punkt) => void;
    onValjRuttpunkt: (uppdragId: string, punktId: string) => void;
    onFlyttaSamling: (p: Punkt) => void;
    onValjUppdrag: (uppdragId: string) => void;
  };
}

/** "Anna Berg" → "AB", "Anna" → "AN". Alltid två tecken, så att de inte förväxlas med A (start) och B (mål). */
function initialer(namn: string): string {
  const delar = namn.trim().split(/\s+/).filter(Boolean);
  if (delar.length === 0) return "?";
  const text = delar.length > 1 ? delar[0][0] + delar[delar.length - 1][0] : delar[0].slice(0, 2);
  return text.toUpperCase();
}

function ikon(text: string, val: { storlek: number; fyll: string; kant: string; farg: string; genomskinlig?: boolean; fyrkant?: boolean }) {
  const el = document.createElement("div");
  el.textContent = text;
  Object.assign(el.style, {
    width: `${val.storlek}px`,
    height: `${val.storlek}px`,
    lineHeight: `${val.storlek - 4}px`,
    boxSizing: "border-box",
    textAlign: "center",
    fontSize: `${Math.max(9, Math.round(val.storlek * 0.42))}px`,
    fontWeight: "700",
    color: val.farg,
    background: val.fyll,
    border: `2px solid ${val.kant}`,
    borderRadius: val.fyrkant ? "5px" : "50%",
    boxShadow: "0 1px 4px rgba(0,0,0,.45)",
    opacity: val.genomskinlig ? "0.8" : "1",
  });
  return L.divIcon({ html: el, className: "", iconSize: [val.storlek, val.storlek], iconAnchor: [val.storlek / 2, val.storlek / 2] });
}

function textruta(rader: (string | undefined | null)[]): HTMLElement {
  const ruta = document.createElement("div");
  rader.filter(Boolean).forEach((rad, i) => {
    const el = document.createElement(i === 0 ? "strong" : "div");
    el.textContent = rad as string;
    if (i === 0) el.style.display = "block";
    ruta.appendChild(el);
  });
  return ruta;
}

function etikett(text: string): HTMLElement {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
}

const ll = (p: Punkt): L.LatLngTuple => [p.lat, p.lon];
const franLatLng = (p: L.LatLng): Punkt => ({ lat: p.lat, lon: p.lng });

/** Jaktmarkens gräns och markeringar ur planen. */
export function ritaPlanJaktmark(grupp: L.LayerGroup, mark: PlanJaktmark | null | undefined) {
  if (!mark) return;
  if (mark.grans.length >= 3) {
    L.polygon(mark.grans, {
      color: KART_FARGER.grans,
      weight: 3,
      fillColor: KART_FARGER.grans,
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(grupp);
  }
  for (const p of mark.punkter) {
    const pass = arPass(p.typ);
    const m = L.circleMarker([p.lat, p.lon], {
      radius: pass ? 6 : 4,
      color: KART_FARGER.etikettYta,
      weight: 2,
      fillColor: punktFarg(p.typ),
      fillOpacity: 1,
    });
    m.bindPopup(textruta([p.namn || kategoriNamn(p.typ), p.namn ? kategoriNamn(p.typ) : null]));
    if (pass && p.namn) {
      m.bindTooltip(etikett(p.namn), { permanent: true, direction: "right", offset: [7, 0], className: "skade-etikett" });
    }
    m.addTo(grupp);
  }
}

function ritaUppdrag(grupp: L.LayerGroup, u: Uppdrag, val: PlanRitval) {
  const fokus = val.fokusId === u.id;
  const red = fokus ? val.redigera : undefined;
  const rubrik = `${u.forare || "Hundförare"}${u.hund ? ` – ${u.hund}` : ""}`;

  // Rutten: full linje för uppdraget i fokus, tunn och streckad för övriga (om de visas alls).
  if (u.rutt.length >= 2 && (fokus || val.visaAllaRutter)) {
    if (fokus) {
      L.polyline(u.rutt.map(ll), { color: "#ffffff", weight: 7, opacity: 0.9, interactive: false }).addTo(grupp);
    }
    L.polyline(u.rutt.map(ll), {
      color: u.farg,
      weight: fokus ? 4 : 2,
      opacity: fokus ? 1 : 0.7,
      dashArray: fokus ? undefined : "6 6",
      interactive: false,
    }).addTo(grupp);
  }

  if (fokus) {
    u.rutt.forEach((p: Ruttpunkt, i) => {
      const forst = i === 0;
      const sist = i === u.rutt.length - 1 && u.rutt.length > 1;
      const m = L.marker(ll(p), {
        draggable: !!red,
        zIndexOffset: p.viktig ? 600 : 500,
        icon: p.viktig
          ? ikon("!", { storlek: 24, fyll: u.farg, kant: "#ffffff", farg: "#ffffff", fyrkant: true })
          : forst || sist
            ? ikon(forst ? "A" : "B", { storlek: 22, fyll: "#ffffff", kant: u.farg, farg: u.farg })
            : ikon("", { storlek: 12, fyll: u.farg, kant: "#ffffff", farg: "#ffffff" }),
      });
      const typ = forst ? "Start" : sist ? "Mål" : p.viktig ? "Viktig punkt" : "Viapunkt";
      if (p.viktig || p.text) {
        m.bindTooltip(etikett(p.text || "Viktig punkt"), {
          permanent: true,
          direction: "right",
          offset: [12, 0],
          className: "skade-etikett skade-etikett-alltid",
        });
      }
      if (red) {
        m.on("dragend", () => red.onFlyttaRuttpunkt(u.id, p.id, franLatLng(m.getLatLng())));
        m.on("click", () => red.onValjRuttpunkt(u.id, p.id));
      } else {
        m.bindPopup(textruta([p.text || typ, p.text ? typ : null, rubrik]));
      }
      m.addTo(grupp);
    });
  }

  if (u.slapp) {
    const m = L.marker(ll(u.slapp), {
      draggable: !!red,
      zIndexOffset: fokus ? 700 : 300,
      icon: fokus
        ? ikon("S", { storlek: 30, fyll: u.farg, kant: "#ffffff", farg: "#ffffff" })
        : ikon(initialer(u.forare), { storlek: 26, fyll: u.farg, kant: "#ffffff", farg: "#ffffff", genomskinlig: true }),
    });
    if (red) {
      m.on("dragend", () => red.onFlyttaSlapp(u.id, franLatLng(m.getLatLng())));
    } else if (val.redigera) {
      m.on("click", () => val.redigera?.onValjUppdrag(u.id));
      m.bindTooltip(etikett(rubrik), { direction: "top", offset: [0, -12] });
    } else {
      m.bindPopup(
        textruta([rubrik, u.slappTid ? `Släpper ${u.slappTid}` : "Släpplats", u.anteckning]),
      );
    }
    if (fokus) {
      m.bindTooltip(etikett(`Släpp${u.slappTid ? ` ${u.slappTid}` : ""}`), {
        permanent: true,
        direction: "top",
        offset: [0, -16],
        className: "skade-etikett skade-etikett-alltid",
      });
    }
    m.addTo(grupp);
  }
}

/** Ritar hela planen i gruppen (som töms först). */
export function ritaPlan(grupp: L.LayerGroup, innehall: PlanInnehall, val: PlanRitval) {
  grupp.clearLayers();
  ritaPlanJaktmark(grupp, innehall.jaktmark);
  if (innehall.samling) {
    const s = innehall.samling;
    const m = L.marker(ll(s), {
      draggable: !!val.redigera,
      zIndexOffset: 200,
      icon: ikon("⚑", { storlek: 26, fyll: "#14201b", kant: "#ffffff", farg: "#ffffff", fyrkant: true }),
    });
    m.bindTooltip(etikett(`Samling${s.tid ? ` ${s.tid}` : ""}`), {
      permanent: true,
      direction: "top",
      offset: [0, -14],
      className: "skade-etikett skade-etikett-alltid",
    });
    if (val.redigera) {
      const red = val.redigera;
      m.on("dragend", () => red.onFlyttaSamling(franLatLng(m.getLatLng())));
    } else if (s.text) {
      m.bindPopup(textruta(["Samling", s.tid, s.text]));
    }
    m.addTo(grupp);
  }
  // Övriga först, så att uppdraget i fokus hamnar överst.
  for (const u of innehall.uppdrag) if (u.id !== val.fokusId) ritaUppdrag(grupp, u, val);
  for (const u of innehall.uppdrag) if (u.id === val.fokusId) ritaUppdrag(grupp, u, val);
}

/** Alla punkter i planen, för att zooma så att allt syns. */
export function planGranser(innehall: PlanInnehall): L.LatLngBounds | null {
  const punkter: L.LatLngTuple[] = [
    ...(innehall.jaktmark?.grans ?? []),
    ...(innehall.jaktmark?.punkter ?? []).map((p): L.LatLngTuple => [p.lat, p.lon]),
    ...(innehall.samling ? [ll(innehall.samling)] : []),
    ...innehall.uppdrag.flatMap((u) => [...(u.slapp ? [ll(u.slapp)] : []), ...u.rutt.map(ll)]),
  ];
  return punkter.length > 0 ? L.latLngBounds(punkter) : null;
}

/** Stilar som delas av Karta-fliken och planeraren. Läggs in en gång. */
export function laggInKartstilar(typsnitt: string) {
  if (document.getElementById("skade-karta-stil")) return;
  const stil = document.createElement("style");
  stil.id = "skade-karta-stil";
  stil.textContent = `
    .skade-karta { font-family: ${typsnitt}, system-ui, sans-serif; }
    .skade-karta .skade-etikett {
      background: ${KART_FARGER.etikettYta}; color: ${KART_FARGER.etikettText};
      border: none; border-radius: 6px; padding: 1px 6px; font-size: 12px; font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,.35); display: none;
    }
    .skade-karta .skade-etikett::before { display: none; }
    .skade-karta.visa-namn .skade-etikett, .skade-karta .skade-etikett-alltid { display: block; }
    .skade-karta .leaflet-popup-content { margin: 10px 14px; font-size: 14px; }
    .skade-karta .leaflet-control-attribution { font-size: 10px; }
    .skade-karta.skade-ritar, .skade-karta.skade-ritar .leaflet-interactive { cursor: crosshair; }
  `;
  document.head.appendChild(stil);
}

export const KARTLAGER = {
  karta: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    kalla: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
  },
  terrang: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    maxZoom: 17,
    kalla:
      'Kartdata &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>, SRTM | Kartbild &copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA)',
  },
} as const;

export type Kartlagerval = keyof typeof KARTLAGER;

/** Lägger på (eller byter) kartbilden. Svarar med lagret, som tas bort vid nästa byte. */
export function laggPaKartlager(karta: L.Map, val: Kartlagerval): L.TileLayer {
  const k = KARTLAGER[val];
  return L.tileLayer(k.url, {
    maxZoom: 19,
    maxNativeZoom: k.maxZoom,
    attribution: k.kalla,
    // Sidan kör Cross-Origin-Embedder-Policy, så kartbilderna måste hämtas med CORS.
    crossOrigin: "anonymous",
  }).addTo(karta);
}
