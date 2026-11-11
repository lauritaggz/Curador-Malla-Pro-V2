import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aplicar, crearHistorial, deshacer, fusionar, rehacer } from "../core/historial";
import { aTexto, exportarBorrador, exportarFinal, nombreArchivo } from "../core/exportar";
import * as op from "../core/operaciones";
import { ramoPorUid } from "../core/refs";
import type { Malla, PrereqEstado, Problema, Ramo } from "../core/types";
import { resumirProblemas, validar } from "../core/validar";
import { DocPanel } from "./DocPanel";
import type { Pagina } from "./documentos";
import { Grid } from "./Grid";
import { Icon } from "./Icon";
import { Inspector, type Foco } from "./Inspector";
import { descargarArchivo } from "./guardado";
import { Modal } from "./Modal";
import { PanelDatos, PanelNotas, PanelProblemas } from "./Paneles";

type Panel = null | "problemas" | "notas" | "datos";
type Dialogo =
  | null
  | { tipo: "descarga" }
  | { tipo: "eliminar"; uid: string }
  | { tipo: "estado"; uid: string }
  | { tipo: "fin" }
  | { tipo: "salir" };

export function Editor({
  inicial, paginas, onPaginas, onGuardar, fallaGuardado, onNueva,
}: {
  inicial: Malla;
  paginas: Pagina[];
  onPaginas: (p: Pagina[]) => void;
  onGuardar: (m: Malla) => boolean;
  fallaGuardado: boolean;
  onNueva: () => void;
}) {
  const [h, setH] = useState(() => crearHistorial(inicial));
  const malla = h.presente;
  const ultimo = useRef<{ clave: string; t: number } | null>(null);

  /** Todas las ediciones pasan por aquí. Con `clave`, escribir seguido en un campo cuenta como un solo paso. */
  const editar = useCallback((fn: (m: Malla) => Malla, clave?: string) => {
    const ahora = Date.now();
    const fusion = !!clave && ultimo.current?.clave === clave && ahora - ultimo.current.t < 1500;
    ultimo.current = clave ? { clave, t: ahora } : null;
    setH((prev) => {
      const sig = fn(prev.presente);
      return fusion ? fusionar(prev, sig) : aplicar(prev, sig);
    });
  }, []);

  const [sel, setSel] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [focoDatos, setFocoDatos] = useState<string | null>(null);
  const [foco, setFoco] = useState<Foco | null>(null);
  const [modoClic, setModoClic] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [docVisible, setDocVisible] = useState(() => window.innerWidth >= 1000);
  const [docAncho, setDocAncho] = useState(() => Math.round(Math.min(560, Math.max(320, window.innerWidth * 0.32))));
  const [guardadoOk, setGuardadoOk] = useState(true);
  const [aviso, setAviso] = useState("");

  const problemas = useMemo(() => validar(malla), [malla]);
  const resumen = useMemo(() => resumirProblemas(problemas), [problemas]);
  const revisados = malla.ramos.filter((r) => r.revisado).length;
  const sinRevisar = malla.ramos.length - revisados;
  const ramoSel = sel ? ramoPorUid(malla, sel) : undefined;

  // Guardado automático (CA-6.3) con aviso si el navegador no deja guardar (RNF-4).
  useEffect(() => {
    const t = setTimeout(() => setGuardadoOk(onGuardar(malla)), 350);
    return () => clearTimeout(t);
  }, [malla, onGuardar]);

  useEffect(() => { if (sel && !ramoSel) setSel(null); }, [sel, ramoSel]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 4000); return () => clearTimeout(t); }, [aviso]);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (CA-6.4).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); ultimo.current = null; setH(deshacer); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); ultimo.current = null; setH(rehacer); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // Evitar perder el trabajo al cerrar con el guardado fallando.
  useEffect(() => {
    if (guardadoOk && !fallaGuardado) return;
    const antes = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [guardadoOk, fallaGuardado]);

  const cambiarRamo = (uid: string, c: Partial<Ramo>, clave?: string) => editar((m) => op.actualizarRamo(m, uid, c), clave);

  const ir = (p: Problema) => {
    setPanel(null);
    if (p.campoMalla) { setFocoDatos(p.campoMalla); setPanel("datos"); return; }
    if (p.uid) { setSel(p.uid); setFoco({ campo: p.campo ?? "general", n: Date.now() }); return; }
    if (p.regla === "V-15") setPanel("notas");
    else if (p.regla === "V-14") setAviso("Puedes mover ramos a ese semestre o eliminarlo con el ícono de papelera.");
  };

  const seleccionar = (uid: string) => { setSel(uid); setFoco(null); };

  const alternarPrereq = (uid: string) => {
    if (!sel) return;
    const yaEsta = ramoSel?.prereqs.includes(uid);
    editar((m) => (yaEsta ? op.quitarPrereq(m, sel, uid) : op.agregarPrereq(m, sel, uid)));
  };

  const cambiarEstado = (uid: string, e: PrereqEstado) => {
    const r = ramoPorUid(malla, uid);
    if (!r || r.prereqEstado === e) return;
    if (e === "ninguno" && op.tieneRequisitos(r)) setDialogo({ tipo: "estado", uid });
    else editar((m) => op.cambiarEstado(m, uid, e));
  };

  const revisadoYSiguiente = () => {
    if (!ramoSel) return;
    const m2 = op.actualizarRamo(malla, ramoSel.uid, { revisado: true });
    editar(() => m2);
    const sig = op.siguienteSinRevisar(m2, ramoSel.uid);
    if (sig) { setSel(sig.uid); setFoco(null); requestAnimationFrame(() => document.querySelector(`[data-uid="${sig.uid}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })); }
    else setDialogo({ tipo: "fin" });
  };

  /** Ctrl+Enter = «Revisado y siguiente» desde cualquier campo; el flujo principal sin soltar el teclado. */
  const accionRef = useRef(revisadoYSiguiente);
  accionRef.current = revisadoYSiguiente;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !document.querySelector(".modal, .drawer")) {
        e.preventDefault();
        accionRef.current();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const irAlSiguiente = () => {
    const sig = op.siguienteSinRevisar(malla, sel ?? undefined);
    if (!sig) { setDialogo({ tipo: "fin" }); return; }
    seleccionar(sig.uid);
    requestAnimationFrame(() => document.querySelector(`[data-uid="${sig.uid}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }));
  };

  const agregarRamo = (sem: number) => {
    const { malla: m2, uid } = op.agregarRamo(malla, sem);
    editar(() => m2);
    setSel(uid);
    setFoco({ campo: "nombre", n: Date.now() });
  };

  const descargarFinal = () => {
    descargarArchivo(nombreArchivo(malla), aTexto(exportarFinal(malla)));
    setDialogo(null);
  };
  const pedirDescarga = () => {
    if (resumen.obligatorias.length || sinRevisar > 0 || malla.ramos.length === 0) setDialogo({ tipo: "descarga" });
    else descargarFinal();
  };

  const contador = resumen.obligatorias.length
    ? { tono: "bad", texto: String(resumen.obligatorias.length) }
    : resumen.avisos.length ? { tono: "warn", texto: String(resumen.avisos.length) } : { tono: "ok", texto: "✓" };
  const pct = malla.ramos.length ? Math.round((revisados / malla.ramos.length) * 100) : 0;
  const notasPend = malla.notas.filter((n) => !n.resuelta).length;

  const dialogoSel = dialogo && "uid" in dialogo ? ramoPorUid(malla, dialogo.uid) : undefined;

  return (
    <div className="editor">
      <div className="barra">
        <div className="barra-titulo">
          <button className="icon-button" onClick={() => setDialogo({ tipo: "salir" })} aria-label="Volver al inicio"><Icon name="back" /></button>
          <div>
            <span className="kicker">{malla.universidad || "Universidad sin nombre"}</span>
            <h1>{malla.carrera || "Carrera sin nombre"}{malla.versionPlan && <em> · Plan {malla.versionPlan}</em>}</h1>
          </div>
        </div>

        <div className="progreso" role="group" aria-label="Avance de la revisión">
          <span><b>{revisados}</b> de {malla.ramos.length} revisados</span>
          <div className="barra-av" role="progressbar" aria-valuemin={0} aria-valuemax={malla.ramos.length} aria-valuenow={revisados}><i style={{ width: `${pct}%` }} /></div>
        </div>

        <div className={`estado-guardado ${guardadoOk && !fallaGuardado ? "" : "malo"}`} role="status">
          <Icon name={guardadoOk && !fallaGuardado ? "check" : "warning"} size={14} />
          {guardadoOk && !fallaGuardado ? "Guardado en este navegador" : "No se pudo guardar: descarga un borrador"}
        </div>

        <div className="acciones">
          <div className="deshacer">
            <button className="icon-button" onClick={() => { ultimo.current = null; setH(deshacer); }} disabled={!h.pasado.length} aria-label="Deshacer (Ctrl+Z)" title="Deshacer (Ctrl+Z)"><Icon name="undo" /></button>
            <button className="icon-button" onClick={() => { ultimo.current = null; setH(rehacer); }} disabled={!h.futuro.length} aria-label="Rehacer (Ctrl+Shift+Z)" title="Rehacer (Ctrl+Shift+Z)"><Icon name="redo" /></button>
          </div>
          <button className={`secondary ${docVisible ? "on" : ""}`} aria-pressed={docVisible} onClick={() => setDocVisible(!docVisible)}><Icon name="panel" size={16} /> Documento</button>
          <button className="secondary" onClick={() => { setFocoDatos(null); setPanel("datos"); }}><Icon name="settings" size={16} /> Datos</button>
          <button className="secondary" onClick={() => setPanel("notas")}><Icon name="note" size={16} /> Notas{notasPend > 0 && <b className="cuenta">{notasPend}</b>}</button>
          <button className={`secondary problemas ${contador.tono}`} onClick={() => setPanel("problemas")} aria-label={`Problemas: ${resumen.obligatorias.length} por corregir, ${resumen.avisos.length} avisos`}>
            <Icon name="issues" size={16} /> Problemas <b className="cuenta">{contador.texto}</b>
          </button>
          <button className="secondary" onClick={() => { descargarArchivo(nombreArchivo(malla, true), aTexto(exportarBorrador(malla))); setAviso("Borrador descargado. Puedes cargarlo después para seguir donde quedaste."); }}><Icon name="download" size={16} /> Borrador</button>
          <button className="primary" onClick={pedirDescarga}><Icon name="download" size={16} /> Descargar JSON final</button>
        </div>
      </div>

      <div className="cuerpo">
        {docVisible && (
          <>
            <div className="doc-wrap" style={{ width: docAncho }}>
              <DocPanel paginas={paginas} onPaginas={onPaginas} />
            </div>
            <Divisor ancho={docAncho} onAncho={setDocAncho} />
          </>
        )}
        <div className="centro">
          <div className="leyenda">
            <span><i className="punto azul" /> Prerrequisito</span>
            <span><i className="punto verde" /> Ramo que desbloquea</span>
            <p>{modoClic ? "Modo elegir: haz clic en los ramos que son prerrequisito." : "Flechas para moverte entre ramos, Enter para abrir, Alt + flechas para moverlo de semestre."}</p>
            {sinRevisar > 0 && <button className="secondary mini siguiente" onClick={irAlSiguiente}>{revisados === 0 && !sel ? "Empezar a revisar" : "Siguiente sin revisar"} <Icon name="arrow" size={14} /></button>}
          </div>
          <Grid
            malla={malla}
            sel={sel}
            problemasPorRamo={resumen.porRamo}
            modoClic={modoClic}
            onSelect={(uid) => { if (modoClic && uid !== sel) return; seleccionar(uid); }}
            onMover={(uid, sem, i) => editar((m) => op.moverRamo(m, uid, sem, i))}
            onAgregar={agregarRamo}
            onAgregarSemestre={() => editar(op.agregarSemestre)}
            onEliminarSemestre={(s) => editar((m) => op.eliminarSemestre(m, s))}
            onAlternarPrereq={alternarPrereq}
          />
        </div>
        {ramoSel && (
          <Inspector
            key={ramoSel.uid}
            malla={malla}
            ramo={ramoSel}
            problemas={resumen.porRamo.get(ramoSel.uid) ?? []}
            foco={foco}
            modoClic={modoClic}
            onModoClic={setModoClic}
            onCambiar={(c, clave) => cambiarRamo(ramoSel.uid, c, clave)}
            onEstado={(e) => cambiarEstado(ramoSel.uid, e)}
            onAgregarPrereq={(u) => editar((m) => op.agregarPrereq(m, ramoSel.uid, u))}
            onQuitarPrereq={(u) => editar((m) => op.quitarPrereq(m, ramoSel.uid, u))}
            onQuitarRoto={(r) => editar((m) => op.quitarPrereqRoto(m, ramoSel.uid, r))}
            onSeleccionar={seleccionar}
            onRevisadoSiguiente={revisadoYSiguiente}
            onAlternarRevisado={() => cambiarRamo(ramoSel.uid, { revisado: !ramoSel.revisado })}
            onEliminar={() => setDialogo({ tipo: "eliminar", uid: ramoSel.uid })}
            onCerrar={() => { setSel(null); setModoClic(false); }}
          />
        )}
      </div>

      {panel === "problemas" && <PanelProblemas obligatorias={resumen.obligatorias} avisos={resumen.avisos} listo={sinRevisar === 0} onIr={ir} onClose={() => setPanel(null)} />}
      {panel === "notas" && <PanelNotas malla={malla} onAgregar={(t) => editar((m) => op.agregarNota(m, t))} onAlternar={(id) => editar((m) => op.alternarNota(m, id))} onEliminar={(id) => editar((m) => op.eliminarNota(m, id))} onClose={() => setPanel(null)} />}
      {panel === "datos" && <PanelDatos malla={malla} foco={focoDatos} onCambiar={(c, clave) => editar((m) => op.actualizarMalla(m, c), `malla:${clave}`)} onClose={() => setPanel(null)} />}

      {dialogo?.tipo === "descarga" && (
        <Modal titulo="Esta malla aún no está lista" onClose={() => setDialogo(null)}
          acciones={<>
            <button className="secondary" onClick={descargarFinal}>Descargar igual</button>
            <button className="primary" data-foco onClick={() => { setDialogo(null); setPanel("problemas"); }}>Ver problemas</button>
          </>}>
          <ul className="faltan">
            {malla.ramos.length === 0 && <li>La malla no tiene ramos.</li>}
            {resumen.obligatorias.length > 0 && <li><b>{resumen.obligatorias.length}</b> {resumen.obligatorias.length === 1 ? "problema obligatorio" : "problemas obligatorios"} por corregir.</li>}
            {sinRevisar > 0 && <li><b>{sinRevisar}</b> {sinRevisar === 1 ? "ramo" : "ramos"} sin revisar.</li>}
          </ul>
          <p>Si la descargas así, el archivo puede traer errores. Laura tendría que corregirlos a mano.</p>
        </Modal>
      )}
      {dialogo?.tipo === "eliminar" && dialogoSel && (
        <Modal titulo="¿Eliminar este ramo?" onClose={() => setDialogo(null)}
          acciones={<>
            <button className="secondary" data-foco onClick={() => setDialogo(null)}>Cancelar</button>
            <button className="danger" onClick={() => { editar((m) => op.eliminarRamo(m, dialogoSel.uid)); setSel(null); setDialogo(null); setAviso("Ramo eliminado. Puedes deshacerlo con Ctrl+Z."); }}>Sí, eliminar</button>
          </>}>
          <p><b>{dialogoSel.nombre || "Ramo sin nombre"}</b> se quitará de la malla y de los prerrequisitos de otros ramos. Puedes deshacerlo con Ctrl+Z.</p>
        </Modal>
      )}
      {dialogo?.tipo === "estado" && dialogoSel && (
        <Modal titulo="Este ramo tiene requisitos cargados" onClose={() => setDialogo(null)}
          acciones={<>
            <button className="secondary" onClick={() => { editar((m) => op.cambiarEstado(m, dialogoSel.uid, "ninguno", false)); setDialogo(null); }}>Dejarlos</button>
            <button className="primary" data-foco onClick={() => { editar((m) => op.cambiarEstado(m, dialogoSel.uid, "ninguno", true)); setDialogo(null); }}>Quitar los requisitos</button>
          </>}>
          <p>Marcaste «No tiene», pero <b>{dialogoSel.nombre}</b> tiene prerrequisitos o semestres requeridos. ¿Quieres quitarlos?</p>
        </Modal>
      )}
      {dialogo?.tipo === "fin" && (
        <Modal titulo="¡Terminaste de revisar!" onClose={() => setDialogo(null)}
          acciones={<>
            <button className="secondary" onClick={() => { setDialogo(null); setPanel("problemas"); }}>Ver problemas</button>
            <button className="primary" data-foco onClick={() => { setDialogo(null); pedirDescarga(); }}>Descargar JSON final</button>
          </>}>
          <p>No quedan ramos sin revisar. {resumen.obligatorias.length ? `Todavía hay ${resumen.obligatorias.length} problema(s) obligatorio(s) por corregir.` : "Tampoco hay problemas obligatorios."}</p>
        </Modal>
      )}
      {dialogo?.tipo === "salir" && (
        <Modal titulo="¿Volver al inicio?" onClose={() => setDialogo(null)}
          acciones={<>
            <button className="secondary" onClick={() => setDialogo(null)}>Seguir editando</button>
            <button className="primary" data-foco onClick={() => { onGuardar(malla); onNueva(); }}>Volver al inicio</button>
          </>}>
          <p>Tu avance queda guardado en este navegador. Desde el inicio podrás elegir «Continuar donde quedé».</p>
        </Modal>
      )}

      {aviso && <div className="toast" role="status">{aviso}</div>}
    </div>
  );
}

/** CA-1.5: divisor arrastrable (y con flechas del teclado) para el ancho del documento. */
function Divisor({ ancho, onAncho }: { ancho: number; onAncho: (n: number) => void }) {
  const limitar = (n: number) => Math.round(Math.min(Math.max(240, n), window.innerWidth - 480));
  return (
    <div
      className="divisor"
      role="separator"
      aria-orientation="vertical"
      aria-label="Cambiar el ancho del documento"
      aria-valuenow={ancho}
      tabIndex={0}
      onPointerDown={(e) => {
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        const x0 = e.clientX;
        const a0 = ancho;
        const mover = (ev: PointerEvent) => onAncho(limitar(a0 + ev.clientX - x0));
        const fin = () => { el.removeEventListener("pointermove", mover); el.removeEventListener("pointerup", fin); };
        el.addEventListener("pointermove", mover);
        el.addEventListener("pointerup", fin);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); onAncho(limitar(ancho - 24)); }
        if (e.key === "ArrowRight") { e.preventDefault(); onAncho(limitar(ancho + 24)); }
      }}
    />
  );
}
