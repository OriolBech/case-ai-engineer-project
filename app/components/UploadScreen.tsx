'use client';

import { useCallback, useRef, useState } from 'react';
import { AppTopbar } from './AppTopbar.tsx';

export interface UploadProgress {
  done: number;
  total: number;
}

export function UploadScreen({
  onUpload,
  busy,
  progress,
  error,
  fileName,
}: {
  onUpload: (file: File) => void;
  busy: boolean;
  progress: UploadProgress | null;
  error: string | null;
  fileName: string | null;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    onUpload(file);
  }, [onUpload]);

  const pct = progress && progress.total > 0 ? Math.round((100 * progress.done) / progress.total) : 0;

  return (
    <>
      <AppTopbar />
      <div className="upload-shell">
        <div className="upload-card">
          <div className="upload-card-head">
            <div className="upload-eyebrow">Reconciliación de MTOs · Tornillería</div>
            <h1 className="upload-title">Sube el MTO</h1>
            <p className="upload-lead">
              Arrastra el Excel de Material Take-Off. Extraemos y normalizamos las líneas de
              tornillería sin que tengas que abrir el fichero al lado.
            </p>
          </div>

          {!busy && (
            <div
              className={`dropzone${dragging ? ' dragging' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="dropzone-icon">⇩</div>
              <div className="dropzone-title">Suelta el .xlsx aquí, o haz clic para elegirlo</div>
              <div className="dropzone-sub">Sólo se procesa la primera hoja con cabeceras reconocibles</div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => pick(e.target.files)}
              />
            </div>
          )}

          {error && <div className="upload-error">{error}</div>}

          {busy && (
            <div className="progress-panel">
              <div className="progress-head">
                <span className="progress-file">{fileName}</span>
                <span className="progress-count mono">
                  {progress ? `${progress.done} / ${progress.total} filas` : 'preparando…'}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress ? pct : 8}%` }} />
              </div>
              <div className="progress-note">
                Extracción con modelo por fila multi-elemento, tablas deterministas para el resto.
                Puede tardar unos segundos por fila la primera vez; si vuelves a subir el mismo
                fichero sin cambiar ninguna fila, esas filas salen al instante.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
