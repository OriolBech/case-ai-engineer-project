/** Estado del repositorio en el momento de la ejecución. Ver SPEC-010 punto 4. */
import { execFileSync } from 'node:child_process';

export interface GitState {
  commit: string | null;
  dirty: boolean;
}

/**
 * Sin git (o fuera de un repo), no se puede afirmar que el árbol estaba limpio: se marca `dirty`
 * en vez de asumir lo contrario. Un commit desconocido nunca se presenta como un commit limpio.
 */
export function getGitState(cwd: string = process.cwd()): GitState {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { commit, dirty: status.trim().length > 0 };
  } catch {
    return { commit: null, dirty: true };
  }
}
