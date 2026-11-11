import { useMemo, useRef, useState } from "react";
import { ErrorImportacion, importarTexto, mallaVacia, type ResultadoImportacion } from "../core/importar";
import type { Malla } from "../core/types";
import { ErrorDocumento, leerArchivos, type Pagina } from "./documentos";
import { Icon } from "./Icon";
import type { Sesion } from "./guardado";

function intentar(texto: string): { ok: ResultadoImportacion } | { error: string } | null {
  if (!texto.trim()) return null;
  try {
    return { ok: importarTexto(texto) };
  } catch (e) {
    return { error: e instanceof ErrorImportacion ? e.message : "No pude leer ese texto. Pídele a la IA que lo genere otra vez." };
  }
}

export function Inicio({
  paginas,
  onPaginas,
  sesion,
  onContinuar,
  onEmpezar,
  avisoAlmacenamiento,
}: {
  paginas: Pagina[];
  onPaginas: (p: Pagina[]) => void;
  sesion: Sesion | null;
  onContinuar: () => void;
  onEmpezar: (m: Malla) => void;
  avisoAlmacenamiento: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [errorDoc, setErrorDoc] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const refDoc = useRef<HTMLInputElement>(null);
  const refJson = useRef<HTMLInputElement>(null);
  const resultado = useMemo(() => intentar(texto), [texto]);

  async function agregarDocumento(archivos: File[]) {
    if (!archivos.length) return;
    setErrorDoc("");
    setLeyendo(true);
    try {
      onPaginas([...paginas, ...(await leerArchivos(archivos))]);
    } catch (e) {
      setErrorDoc(e instanceof ErrorDocumento ? e.message : "No pude abrir ese archivo.");
    } finally {
      setLeyendo(false);
    }
  }

  async function cargarJson(f?: File) {
    if (!f) return;
    setTexto(await f.text());
  }

  const ok = resultado && "ok" in resultado ? resultado.ok : null;
  const error = resultado && "error" in resultado ? resultado.error : null;

  return (
    <main className="inicio">
      <div className="inicio-cabeza">
        <span className="kicker">CURADOR DE MALLAS</span>
        <h1>Revisa y corrige la malla que armó la IA</h1>
        <p className="lead">Compara la malla oficial con el borrador, corrígelo ramo por ramo y descarga el archivo listo. No necesitas ver ni escribir código.</p>
      </div>

      {sesion && (
        <section className="continuar" aria-label="Sesión guardada">
          <div>
            <b>Tienes una malla en curso</b>
            <p>
              {sesion.malla.carrera || "Malla sin nombre"} · {sesion.malla.ramos.filter((r) => r.revisado).length} de {sesion.malla.ramos.length} ramos revisados · guardada {new Date(sesion.guardadoEn).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <button className="primary" onClick={onContinuar}>Continuar donde quedé <Icon name="arrow" /></button>
        </section>
      )}

      <div className="inicio-grid">
        <section className="paso" aria-labelledby="paso1">
          <div className="paso-num">1</div>
          <h2 id="paso1">Malla oficial <em>Opcional, pero recomendado</em></h2>
          <p>Sube la imagen o el PDF de la universidad para verlo al lado mientras corriges.</p>
          <label
            className={`dropzone ${arrastrando ? "over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); void agregarDocumento([...e.dataTransfer.files]); }}
          >
            <input ref={refDoc} type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" multiple onChange={(e) => { void agregarDocumento([...(e.target.files ?? [])]); e.target.value = ""; }} />
            <Icon name="upload" size={24} />
            <b>{leyendo ? "Leyendo el documento…" : "Elige o arrastra tus archivos"}</b>
            <small>PNG, JPG o PDF (hasta 20 páginas)</small>
          </label>
          {errorDoc && <div className="mensaje error" role="alert"><Icon name="warning" />{errorDoc}</div>}
          {paginas.length > 0 && (
            <div className="mensaje ok" role="status">
              <Icon name="check" />✓ {paginas.length} {paginas.length === 1 ? "página cargada" : "páginas cargadas"}
              <button className="text-link" onClick={() => onPaginas([])}>Quitar todas</button>
            </div>
          )}
        </section>

        <section className="paso" aria-labelledby="paso2">
          <div className="paso-num">2</div>
          <h2 id="paso2">Borrador de la IA</h2>
          <p>Carga el archivo que te dio la IA, o pega aquí su respuesta completa.</p>
          <div className="fila">
            <button className="secondary" onClick={() => refJson.current?.click()}><Icon name="file" size={16} /> Elegir archivo .json</button>
            <input ref={refJson} hidden type="file" accept=".json,application/json" onChange={(e) => { void cargarJson(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <label className="campo">
            <span>O pega el texto</span>
            <textarea className="pegar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pega aquí la respuesta de la IA. Puede traer texto antes o después." rows={7} spellCheck={false} />
          </label>
          {error && <div className="mensaje error" role="alert"><Icon name="warning" />{error}</div>}
          {ok && (
            <div className="mensaje ok" role="status">
              <Icon name="check" />
              <span>
                <b>{ok.resumen.carrera}</b> · {ok.resumen.ramos} ramos · {ok.resumen.semestres} semestres
                {ok.resumen.formatoAntiguo && " · formato antiguo, lo convierto por ti"}
                {ok.resumen.eraBorrador && " · borrador: recupero lo que ya revisaste"}
              </span>
            </div>
          )}
          <div className="fila fin">
            <button className="primary" disabled={!ok} onClick={() => ok && onEmpezar(ok.malla)}>Empezar a curar <Icon name="arrow" /></button>
          </div>
          <button className="text-link" onClick={() => onEmpezar(mallaVacia())}>Empezar una malla vacía</button>
        </section>
      </div>

      <section className="guia" aria-labelledby="guia">
        <h2 id="guia">Cómo se usa</h2>
        <ol>
          <li><b>Compara.</b> A la izquierda ves el documento oficial; en el centro, la malla que armó la IA.</li>
          <li><b>Corrige.</b> Arrastra los ramos al semestre correcto y haz clic en uno para editar su nombre, créditos y prerrequisitos.</li>
          <li><b>Marca como revisado.</b> Cuando un ramo coincide con el documento, pulsa «Revisado y siguiente».</li>
          <li><b>Descarga.</b> Con todo revisado y sin problemas, descarga el archivo final y envíaselo a Laura.</li>
        </ol>
        <p className="privado"><Icon name="info" size={16} /> Todo se queda en tu navegador: nada se sube a internet.</p>
      </section>
      {avisoAlmacenamiento && <div className="mensaje warn" role="alert"><Icon name="warning" />Este navegador no deja guardar tu avance automáticamente. Descarga un borrador de vez en cuando.</div>}
    </main>
  );
}
