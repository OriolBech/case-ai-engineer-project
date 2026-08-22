import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findNames, normalizeName } from '../names.ts';
import { normalizeQuality, areEquivalent, checkCoherence, QUALITY_GROUPS } from '../quality.ts';
import { normalizeStandard, findStandards, DIN_EQUIVALENCES } from '../standards.ts';
import { findFinishes, normalizeFinish } from '../finish.ts';
import { deriveMaterialFromQuality } from '../material.ts';
import { MTO_ROWS } from './fixtures.ts';

describe('names', () => {
  test('STUD BOLT is an ESPARRAGO, not a TORNILLO (longest-alias-first)', () => {
    const hits = findNames('STUD BOLT 7/8" X 130 LG');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].value, 'ESPARRAGO');
  });

  test('row 1 yields exactly ESPARRAGO + TUERCA + ARANDELA', () => {
    assert.deepEqual(findNames(MTO_ROWS[0].desc).map((h) => h.value), ['ESPARRAGO', 'TUERCA', 'ARANDELA']);
  });

  test('subtypes collapse: Allen screw and hex screw are both TORNILLO', () => {
    assert.equal(normalizeName('TORNILLO')?.value, 'TORNILLO');
    assert.deepEqual(findNames('Tornillo Allen cilindrico').map((h) => h.value), ['TORNILLO']);
    assert.deepEqual(findNames('Tuerca autoblocante').map((h) => h.value), ['TUERCA']);
  });

  test('THREADED ROD maps to VARILLA ROSCADA (never exercised by the given MTO)', () => {
    assert.deepEqual(findNames('THREADED ROD M12 X 1000').map((h) => h.value), ['VARILLA ROSCADA']);
  });
});

describe('quality', () => {
  test('the equivalence table actually equates non-canonical values', () => {
    assert.ok(areEquivalent('304', 'A2'));
    assert.ok(areEquivalent('18-8', 'A2-70'));
    assert.ok(areEquivalent('316', 'A4-70'));
    assert.ok(areEquivalent('GRADE 5', '8.8'));
    assert.ok(areEquivalent('GRADO 8', '10.9'));
  });

  test('different groups are NEVER equivalent — 8.8 is not 8', () => {
    assert.equal(areEquivalent('8.8', '8'), false);
    assert.equal(areEquivalent('10.9', '10'), false);
    assert.equal(areEquivalent('A2', 'A2-80'), false, 'G1 vs G2');
    assert.equal(areEquivalent('A4-70', 'A4-80'), false, 'G3 vs G4 — row 7 of the MTO');
  });

  test('out-of-catalogue ASTM grades are preserved, not dropped', () => {
    const b7 = normalizeQuality('GR B7');
    assert.equal(b7.inCatalog, false);
    assert.equal(b7.raw, 'GR B7');
    assert.equal(b7.group, null);
  });

  test('all 14 groups are present and every value resolves', () => {
    assert.equal(QUALITY_GROUPS.size, 14);
    for (const [group, values] of QUALITY_GROUPS) {
      for (const v of values) assert.equal(normalizeQuality(v).group, group, `${v} -> ${group}`);
    }
  });

  test('coherence: nut-only qualities on a non-nut', () => {
    assert.equal(checkCoherence(normalizeQuality('8'), 'TORNILLO'), 'NUT_ONLY_QUALITY_ON_NON_NUT');
    assert.equal(checkCoherence(normalizeQuality('10'), 'TORNILLO'), 'NUT_ONLY_QUALITY_ON_NON_NUT');
    assert.equal(checkCoherence(normalizeQuality('8'), 'TUERCA'), null, '8 on a nut is correct');
  });

  test('coherence: bolt grade on a nut — MTO row 13', () => {
    assert.equal(checkCoherence(normalizeQuality('8.8'), 'TUERCA'), 'NON_NUT_QUALITY_ON_NUT');
    assert.equal(checkCoherence(normalizeQuality('A4-80'), 'TUERCA'), null, 'MTO row 11 is fine');
  });

  test('P-8: HV outside a washer resolves by default, flags only when policy says so', () => {
    assert.equal(checkCoherence(normalizeQuality('200HV'), 'TORNILLO'), null);
    assert.equal(
      checkCoherence(normalizeQuality('200HV'), 'TORNILLO', { hvAppliesToWashersOnly: true }),
      'HV_OUTSIDE_WASHER',
    );
  });
});

describe('standards', () => {
  test('the 26 table keys all map', () => {
    for (const [din, target] of DIN_EQUIVALENCES) {
      const r = normalizeStandard(din);
      assert.equal(r?.normalized, target, `${din} -> ${target}`);
      assert.equal(r?.mapped, true);
    }
  });

  test('missing space is tolerated — MTO rows 2, 4, 7', () => {
    assert.equal(normalizeStandard('DIN931')?.normalized, 'ISO 4014');
    assert.equal(normalizeStandard('DIN934')?.normalized, 'ISO 4032');
    assert.equal(normalizeStandard('DIN125')?.normalized, 'ISO 7089');
  });

  test('suffix variants', () => {
    assert.equal(normalizeStandard('DIN 125 A')?.normalized, 'ISO 7089');
    assert.equal(normalizeStandard('DIN 7981 C-H')?.normalized, 'ISO 7049');
    assert.equal(normalizeStandard('DIN 7982 C-H')?.normalized, 'ISO 7050');
  });

  test('DIN 6923 is the only entry mapping to EN, not ISO', () => {
    const r = normalizeStandard('DIN 6923');
    assert.equal(r?.normalized, 'EN 1661');
    assert.equal(r?.family, 'EN');
  });

  test('a DIN outside the table is preserved — MTO row 9', () => {
    const r = normalizeStandard('DIN 975');
    assert.equal(r?.normalized, 'DIN 975');
    assert.equal(r?.mapped, false);
  });

  test('formats the given MTO never exercises', () => {
    assert.equal(normalizeStandard('ASME B18.2.1')?.normalized, 'ASME B18.2.1');
    assert.equal(normalizeStandard('MSS SP-97')?.normalized, 'MSS SP-97');
    assert.equal(normalizeStandard('MSS SP 97')?.normalized, 'MSS SP-97');
    assert.equal(normalizeStandard('DIN EN 14399-4')?.normalized, 'DIN EN 14399-4');
    assert.equal(normalizeStandard('ISO 4032')?.normalized, 'ISO 4032', 'already normalized');
  });

  test('row 1 finds three ASTM standards in order', () => {
    assert.deepEqual(
      findStandards(MTO_ROWS[0].desc).map((s) => s.result.normalized),
      ['ASTM A193', 'ASTM A194', 'ASTM F436'],
    );
  });

  test('DIN EN wins over bare DIN', () => {
    assert.equal(normalizeStandard('DIN EN 1661')?.family, 'DIN EN');
  });
});

describe('finish', () => {
  test('client aliases map to the 7 catalogue values', () => {
    assert.equal(normalizeFinish('zinc plated')?.value, 'CINCADO');
    assert.equal(normalizeFinish('ZN')?.value, 'CINCADO');
    assert.equal(normalizeFinish('HDG')?.value, 'GALVANIZADO EN CALIENTE');
    assert.equal(normalizeFinish('YZP')?.value, 'BICROMATADO');
    assert.equal(normalizeFinish('BL')?.value, 'PAVONADO');
    assert.equal(normalizeFinish('PHOSPHATED')?.value, 'FOSFATADO');
  });

  test('Spanish inflections and accents', () => {
    assert.equal(normalizeFinish('zincada')?.value, 'CINCADO');
    assert.equal(normalizeFinish('zingué')?.value, 'CINCADO', 'French, accent folded');
  });

  test('two-letter aliases are word-bounded — no false positives', () => {
    assert.equal(findFinishes('TABLERO').length, 0, 'BL inside a word must not fire');
    assert.equal(findFinishes('M20 ZONA').length, 0, 'ZN inside a word must not fire');
    assert.equal(findFinishes('BOLT M16, BL').length, 1);
  });

  test('absent finish yields nothing — and that is valid, not a review', () => {
    assert.equal(findFinishes(MTO_ROWS[11].desc).length, 0, 'row 12 has no finish');
  });
});

describe('material (P-3)', () => {
  test('derives INOX from stainless groups, AC from property classes', () => {
    assert.equal(deriveMaterialFromQuality('A4-70')?.material, 'INOX');
    assert.equal(deriveMaterialFromQuality('304')?.material, 'INOX');
    assert.equal(deriveMaterialFromQuality('8.8')?.material, 'AC');
    assert.equal(deriveMaterialFromQuality('8')?.material, 'AC');
    assert.equal(deriveMaterialFromQuality('GR B7')?.material, 'AC');
  });

  test('refuses to guess where the quality carries no material info', () => {
    assert.equal(deriveMaterialFromQuality('200HV'), null, 'hardness says nothing about base metal');
    assert.equal(deriveMaterialFromQuality('45H'), null, 'unknown grade');
  });

  test('every derivation carries the rule that produced it', () => {
    assert.match(deriveMaterialFromQuality('A4-70')!.rule, /^P-3:/);
  });
});

describe('material · A2/A4 son calidades, no materiales', () => {
  test('findMaterials no convierte una calidad inox en material', async () => {
    const { findMaterials } = await import('../material.ts');
    assert.equal(findMaterials('Tornillo DIN 933 M12 x 50, A2').length, 0);
    assert.equal(findMaterials('BOLT DIN931 M20x90, A4-70').length, 0);
  });

  test('sí lo detecta cuando el metal está escrito con sus palabras', async () => {
    const { findMaterials } = await import('../material.ts');
    assert.equal(findMaterials('Arandela plana DIN 125 M10, acero, zincada')[0]?.value, 'AC');
    assert.equal(findMaterials('WASHER, stainless steel')[0]?.value, 'INOX');
  });
});
