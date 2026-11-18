/**
 * Tester för drevets faser (upptag, drev, återgång) och tappt
 * (2026-11-18). Ren beräkningskod, ingen databas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DrevHandelse, HandelseTyp } from "../../db/types";
import {
  aktuellFas,
  antalFaser,
  fasTider,
  oppenTappt,
  tapptTid,
} from "../drevhandelser";

let n = 0;
function h(typ: HandelseTyp, tidpunkt: number): DrevHandelse {
  n += 1;
  return {
    id: `h${n}`,
    jaktdagId: "j",
    hundId: "a",
    drevId: "d",
    typ,
    tidpunkt,
    createdAt: n,
    updatedAt: n,
  };
}

test("drev utan fashändelser räknas som drev hela tiden", () => {
  assert.deepEqual(fasTider([], 1000, 1600), { upptag: 0, drev: 600, atergang: 0 });
  assert.deepEqual(aktuellFas([], 1000), { typ: "drev", sedan: 1000 });
});

test("upptag, drev, återgång, nytt drev - som Filips exempel", () => {
  const lista = [
    h("upptag", 1000),
    h("drev", 1300),
    h("atergang", 2500),
    h("drev", 2700),
  ];
  assert.deepEqual(fasTider(lista, 1000, 3000), {
    upptag: 300,
    drev: 1200 + 300,
    atergang: 200,
  });
  assert.deepEqual(aktuellFas(lista, 1000), { typ: "drev", sedan: 2700 });
  assert.equal(antalFaser(lista, "drev"), 2);
});

test("pågående drev räknas fram till nu", () => {
  const lista = [h("upptag", 1000), h("drev", 1100)];
  assert.deepEqual(fasTider(lista, 1000, null, 1400), {
    upptag: 100,
    drev: 300,
    atergang: 0,
  });
});

test("faser utanför drevets tid kläms in", () => {
  const lista = [h("upptag", 900), h("atergang", 2000)];
  assert.deepEqual(fasTider(lista, 1000, 1500), {
    upptag: 500,
    drev: 0,
    atergang: 0,
  });
});

test("ny fas avslutar en öppen tappt", () => {
  const lista = [h("drev", 1000), h("tappt", 1200), h("atergang", 1500)];
  assert.equal(oppenTappt(lista), null);
  assert.equal(tapptTid(lista, 2000), 300);
});

test("tappt utan avslut räknas till drevslut som förut", () => {
  const lista = [h("tappt", 1200)];
  assert.equal(oppenTappt(lista), 1200);
  assert.equal(tapptTid(lista, 1500), 300);
  assert.equal(tapptTid([h("tappt", 1200), h("atertag", 1260)], 1500), 60);
});
