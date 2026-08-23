/**
 * Los flags de política, conectados.
 *
 * Esto no existía. `.env.example` documentaba diez `POLICY_*` bajo el rótulo "conmutables en caliente
 * durante el challenge" y `03-policies.md` daba a cada política su flag, pero **ninguno se leía**:
 * `processMto` aceptaba `opts.policies` y ningún llamador lo rellenaba, así que `DEFAULT_POLICIES`
 * ganaba siempre. Cambiar el `.env` y volver a ejecutar daba exactamente el mismo resultado.
 *
 * El caso que lo hace urgente es la sesión: "enséñame qué pasa si P-5 no manda a revisión" es una
 * pregunta que van a hacer, y la respuesta tenía que ser una demo, no una diapositiva.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { policiesFromEnv, describeOverrides, DEFAULT_POLICIES } from '../policies.ts';

describe('políticas desde el entorno', () => {
  test('sin variables, los defaults declarados y ningún override', () => {
    const { policies, overrides } = policiesFromEnv({});
    assert.deepEqual(policies, DEFAULT_POLICIES);
    assert.equal(overrides.length, 0);
  });

  test('un valor válido cambia la política y queda registrado', () => {
    const { policies, overrides } = policiesFromEnv({ POLICY_MISSING_STANDARD: 'resolve' });
    assert.equal(policies.missingStandard, 'resolve');
    assert.deepEqual(overrides, [
      { policy: 'missingStandard', env: 'POLICY_MISSING_STANDARD', value: 'resolve', fallback: 'review' },
    ]);
  });

  test('escribir el valor por defecto NO cuenta como override', () => {
    // Si contara, cualquier `.env` copiado del ejemplo marcaría la ejecución como no comparable y
    // el aviso dejaría de significar nada — el mismo ruido que arruina la cola del comprador.
    const { overrides } = policiesFromEnv({ POLICY_MISSING_STANDARD: 'review', POLICY_HV_SCOPE: 'anywhere' });
    assert.equal(overrides.length, 0);
  });

  /**
   * La decisión de diseño de este módulo. Caer al default ante un valor inválido sería un default
   * disparándose en silencio —el modo de fallo que `policies.ts` existe para evitar— y encima con el
   * operador convencido de que ha cambiado algo.
   */
  test('un valor inválido revienta con los valores admitidos, no cae al default', () => {
    assert.throws(
      () => policiesFromEnv({ POLICY_MISSING_STANDARD: 'revisar' }),
      (e: Error) => {
        assert.match(e.message, /POLICY_MISSING_STANDARD="revisar"/);
        assert.match(e.message, /review \| resolve/);
        assert.match(e.message, /03-politicas\.md/);
        return true;
      },
    );
  });

  test('las once políticas conmutables tienen flag, y el flag funciona', () => {
    const env = {
      POLICY_FINISH_SET_SCOPE: 'whole_set',
      POLICY_IMPLICIT_MULTIPLICITY: 'review',
      POLICY_MATERIAL_DERIVATION: 'off',
      POLICY_UNITLESS_LENGTH: 'review',
      POLICY_MISSING_STANDARD: 'resolve',
      POLICY_QUALITY_COHERENCE: 'ignore',
      POLICY_HV_SCOPE: 'washer_only',
      POLICY_OUT_OF_FAMILY: 'silent_skip',
      POLICY_BARE_MEASURE_IN_SET: 'keep',
      POLICY_REJECTED_MEASURE_AS_QUALITY: 'off',
      POLICY_UNKNOWN_FINISH: 'review',
    };
    const { policies, overrides } = policiesFromEnv(env);
    assert.equal(overrides.length, Object.keys(env).length);
    assert.equal(policies.unknownFinish, 'review');
  });

  test('el resumen es legible para una cabecera de script', () => {
    const { overrides } = policiesFromEnv({ POLICY_HV_SCOPE: 'washer_only' });
    assert.equal(describeOverrides(overrides), 'hvScope: anywhere -> washer_only');
  });
});
