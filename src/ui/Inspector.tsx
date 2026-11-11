import { useEffect, useMemo, useRef, useState } from "react";
import { desbloquea } from "../core/operaciones";
import { etiquetaRamo, normalizar, ramoPorUid, refBase } from "../core/refs";
import { ESTADO_ETIQUETA, type CampoProblema, type Malla, type PrereqEstado, type Problema, type Ramo } from "../core/types";
import { Icon } from "./Icon";

export interface Foco { campo: CampoProblema; n: number }

interface Props {
  malla: Malla;
  ramo: Ramo;
  problemas: Problema[];
  foco: Foco | null;
  modoClic: boolean;
  onModoClic: (v: boolean) => void;
  onCambiar: (cambios: Partial<Ramo>, clave?: string) => void;
  onEstado: (e: PrereqEstado) => void;
  onAgregarPrereq: (uid: string) => void;
  onQuitarPrereq: (uid: string) => void;
  onQuitarRoto: (ref: string) => void;
  onSeleccionar: (uid: string) => void;
  onRevisadoSiguiente: () => void;
  onAlternarRevisado: () => void;
  onEliminar: () => void;
  onCerrar: () => void;
}

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function Inspector(p: Props) {
  const { malla, ramo } = p;
  const raiz = useRef<HTMLElement>(null);

  // Al venir desde «Problemas», llevar el foco al campo afectado.
  useEffect(() => {
    if (!p.foco) return;
    const mapa: Record<string, string> = { nombre: "nombre", codigo: "codigo", creditos: "creditos", semestre: "semestre", prereqs: "buscar", estado: "estado" };
    const el = raiz.current?.querySelector<HTMLElement>(`[data-campo="${mapa[p.foco.campo] ?? ""}"]`);
    el?.scrollIntoView({ block: "center" });
    el?.focus();
  }, [p.foco]);

  const prereqs = ramo.prereqs.map((u) => ramoPorUid(malla, u)).filter((x): x is Ramo => !!x);
  const sale = desbloquea(malla, ramo.uid);

  return (
    <aside className="inspector" ref={raiz} aria-label="Datos del ramo">
      <div className="insp-head">
        <div>
          <span className="kicker">EDITANDO RAMO</span>
          <h2>{ramo.nombre || "Ramo sin nombre"}</h2>
        </div>
        <button className="icon-button" onClick={p.onCerrar} aria-label="Cerrar panel del ramo"><Icon name="close" /></button>
      </div>

      <div className="insp-scroll">
        {p.problemas.length > 0 && (
          <ul className="problemas-ramo" aria-label="Problemas de este ramo">
            {p.problemas.map((x, i) => (
              <li key={i} className={x.nivel}>
                <Icon name={x.nivel === "obligatoria" ? "warning" : "info"} size={15} />
                <span><b>{x.titulo}.</b> {x.detalle}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="dos">
          <label className="campo">
            <span>Nombre</span>
            <input data-campo="nombre" value={ramo.nombre} onChange={(e) => p.onCambiar({ nombre: e.target.value }, `nombre:${ramo.uid}`)} />
          </label>
          <label className="campo">
            <span>Código <em>Opcional</em></span>
            <input data-campo="codigo" className="mono" value={ramo.codigo ?? ""} onChange={(e) => p.onCambiar({ codigo: e.target.value || null }, `codigo:${ramo.uid}`)} />
          </label>
        </div>
        <div className="dos">
          <label className="campo">
            <span>Créditos</span>
            <input data-campo="creditos" type="number" inputMode="decimal" min={0} value={ramo.creditos ?? ""} onChange={(e) => p.onCambiar({ creditos: num(e.target.value) }, `creditos:${ramo.uid}`)} />
          </label>
          <label className="campo">
            <span>Semestre</span>
            <select data-campo="semestre" value={ramo.semestre} onChange={(e) => p.onCambiar({ semestre: Number(e.target.value) })}>
              {Array.from({ length: malla.numSemestres }, (_, i) => <option key={i} value={i + 1}>Semestre {i + 1}</option>)}
            </select>
          </label>
        </div>
        <label className="campo">
          <span>Número en el documento <em>Opcional</em></span>
          <input type="number" min={0} value={ramo.numeroEnDocumento ?? ""} onChange={(e) => p.onCambiar({ numeroEnDocumento: num(e.target.value) }, `num:${ramo.uid}`)} />
          <small>Si el ramo no tiene código, este número lo identifica.</small>
        </label>

        <fieldset className="seccion">
          <legend>Prerrequisitos</legend>
          <p>¿Este ramo necesita otros ramos aprobados?</p>
          <div className="segmentado" role="radiogroup" aria-label="Estado de los prerrequisitos">
            {(["ninguno", "conocido", "desconocido"] as PrereqEstado[]).map((v, i) => (
              <button key={v} role="radio" aria-checked={ramo.prereqEstado === v} className={ramo.prereqEstado === v ? "activo" : ""} data-campo={i === 0 ? "estado" : undefined} onClick={() => p.onEstado(v)}>
                {ESTADO_ETIQUETA[v]}
              </button>
            ))}
          </div>

          <div className="requeridos">
            {prereqs.map((r) => (
              <div className="req-item azul" key={r.uid}>
                <button className="req-nombre" onClick={() => p.onSeleccionar(r.uid)} title="Ir a este ramo"><span className="mono">{refBase(r) || "—"}</span> {r.nombre || "Sin nombre"}<small>Sem. {r.semestre}</small></button>
                <button className="icon-button" onClick={() => p.onQuitarPrereq(r.uid)} aria-label={`Quitar ${r.nombre}`}><Icon name="close" size={14} /></button>
              </div>
            ))}
            {ramo.prereqsRotos.map((ref) => (
              <div className="req-item roto" key={ref}>
                <span className="req-nombre"><span className="mono">{ref}</span> no existe en la malla</span>
                <button className="icon-button" onClick={() => p.onQuitarRoto(ref)} aria-label={`Quitar ${ref}`}><Icon name="close" size={14} /></button>
              </div>
            ))}
          </div>

          <Buscador malla={malla} ramo={ramo} onElegir={p.onAgregarPrereq} />
          <label className="check">
            <input type="checkbox" checked={p.modoClic} onChange={(e) => p.onModoClic(e.target.checked)} />
            <span>Elegir haciendo clic en la malla</span>
          </label>
          {p.modoClic && <p className="ayuda"><Icon name="cursor" size={14} /> Haz clic en un ramo de la malla para agregarlo o quitarlo como prerrequisito.</p>}

          <label className="campo">
            <span>Semestres aprobados requeridos <em>Opcional</em></span>
            <input type="number" min={0} value={ramo.semestresAprobados ?? ""} onChange={(e) => p.onCambiar({ semestresAprobados: num(e.target.value), ...(num(e.target.value) != null && ramo.prereqEstado !== "conocido" ? { prereqEstado: "conocido" as const } : {}) }, `sa:${ramo.uid}`)} />
            <small>Por ejemplo, «Tener 4 semestres aprobados».</small>
          </label>
        </fieldset>

        <label className="campo">
          <span>Texto original del requisito <em>Opcional</em></span>
          <textarea rows={3} value={ramo.prereqTexto ?? ""} onChange={(e) => p.onCambiar({ prereqTexto: e.target.value || null }, `txt:${ramo.uid}`)} placeholder="Copia aquí lo que dice el documento. Si dice «A o B», déjalo aquí." />
        </label>

        {sale.length > 0 && (
          <div className="seccion desbloquea">
            <h3>Este ramo desbloquea</h3>
            {sale.map((r) => (
              <button key={r.uid} className="ir" onClick={() => p.onSeleccionar(r.uid)}><span className="mono">{refBase(r) || "—"}</span> {r.nombre || "Sin nombre"} <Icon name="arrow" size={14} /></button>
            ))}
          </div>
        )}

        <button className="eliminar" onClick={p.onEliminar}><Icon name="trash" size={16} /> Eliminar ramo</button>
      </div>

      <div className="insp-pie">
        <button className="secondary" onClick={p.onAlternarRevisado} aria-pressed={ramo.revisado}>
          {ramo.revisado ? <><Icon name="check" size={15} /> Revisado (quitar)</> : "Marcar revisado"}
        </button>
        <button className="primary" onClick={p.onRevisadoSiguiente}>Revisado y siguiente <kbd>Ctrl ↵</kbd></button>
      </div>
    </aside>
  );
}

/** Búsqueda por código o nombre, sin importar tildes, con teclado (CA-4.2). */
function Buscador({ malla, ramo, onElegir }: { malla: Malla; ramo: Ramo; onElegir: (uid: string) => void }) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const opciones = useMemo(() => {
    const nq = normalizar(q);
    return malla.ramos
      .filter((r) => r.uid !== ramo.uid && !ramo.prereqs.includes(r.uid))
      .filter((r) => !nq || normalizar(`${refBase(r)} ${r.nombre}`).includes(nq))
      .slice(0, 8);
  }, [q, malla.ramos, ramo.uid, ramo.prereqs]);

  useEffect(() => setActivo(0), [q]);
  const elegir = (r: Ramo) => { onElegir(r.uid); setQ(""); setAbierto(false); };

  return (
    <div className="buscador">
      <div className="entrada-icono">
        <Icon name="search" size={16} />
        <input
          data-campo="buscar"
          role="combobox"
          aria-expanded={abierto}
          aria-controls="lista-prereq"
          aria-activedescendant={abierto && opciones[activo] ? `op-${opciones[activo].uid}` : undefined}
          aria-label="Buscar prerrequisito por código o nombre"
          placeholder="Buscar por código o nombre…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(a + 1, opciones.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && abierto && opciones[activo]) { e.preventDefault(); elegir(opciones[activo]); }
            else if (e.key === "Escape" && abierto) { e.stopPropagation(); setAbierto(false); }
          }}
        />
      </div>
      {abierto && (
        <ul id="lista-prereq" role="listbox" className="opciones">
          {opciones.length === 0 && <li className="sin">No hay ramos que coincidan</li>}
          {opciones.map((r, i) => (
            <li key={r.uid} id={`op-${r.uid}`} role="option" aria-selected={i === activo} className={i === activo ? "activa" : ""} onMouseDown={(e) => { e.preventDefault(); elegir(r); }} onMouseEnter={() => setActivo(i)}>
              <span>{etiquetaRamo(r)}</span><small>Sem. {r.semestre}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
