/**
 * La evidencia literal: lo que separa una corrección auditable de una opinión.
 *
 * SPEC-015 exige que toda corrección venga con un trozo **literal** de la fila. No es burocracia: es
 * lo que permite que dentro de seis meses alguien relea la fila y entienda por qué se compró lo que
 * se compró. Una paráfrasis — "la fila dice que es inoxidable" — no se puede comprobar contra nada.
 *
 * Estos tests fijan además algo que no se ve: la regla la aplican DOS sitios —el servidor, que la
 * impone, y el panel del comprador, que la comprueba mientras escribe— y por eso vive en una sola
 * función. Con dos copias, la primera divergencia produce un formulario que da por buena una
 * evidencia que el servidor rechaza, y el comprador descubre el problema después de redactar el
 * motivo.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceMatches } from '../evidence.ts';

const ROW = '23 | Tuerca | GR 12H | M12 | 90 | uds | ISO 4032 | zincado';

describe('lo que se acepta', () => {
  test('un trozo tal cual', () => {
    assert.equal(evidenceMatches(ROW, 'GR 12H'), true);
    assert.equal(evidenceMatches(ROW, 'ISO 4032'), true);
  });

  test('lo que no cambia el significado: mayúsculas, espacios de más, forma Unicode', () => {
    assert.equal(evidenceMatches(ROW, 'gr 12h'), true);
    assert.equal(evidenceMatches(ROW, '  GR   12H  '), true);
    assert.equal(evidenceMatches('Tornillo M16×60', 'M16×60'.normalize('NFD')), true);
  });
});

describe('lo que se rechaza, y es el punto entero', () => {
  test('una paráfrasis, por muy cierta que sea', () => {
    assert.equal(evidenceMatches(ROW, 'la fila dice que es una tuerca métrica'), false);
  });

  test('un valor que el sistema dedujo pero la fila no escribe', () => {
    // `AC` sale de derivar la calidad (P-3). Como evidencia no vale: no está en el papel.
    assert.equal(evidenceMatches(ROW, 'AC'), false);
  });

  test('vacío', () => {
    assert.equal(evidenceMatches(ROW, '   '), true, 'la cadena vacía está en cualquier texto…');
    // …por eso el vacío lo corta quien llama, antes de preguntar. `proposeCorrection` exige
    // `evidence.trim()` y el panel bloquea el botón: esta función responde a "¿aparece?", no a
    // "¿es suficiente?".
  });
});
