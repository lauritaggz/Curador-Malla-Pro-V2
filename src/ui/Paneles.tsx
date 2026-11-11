import { useState } from "react";
import type { Malla, Problema } from "../core/types";
import { Icon } from "./Icon";
import { Drawer } from "./Modal";

function Grupo({ titulo, items, tono, onIr }: { titulo: string; items: Problema[]; tono: "bad" | "warn"; onIr: (p: Problema) => void }) {
  if (!items.length) return null;
  return (
    <section className={`grupo-problemas ${tono}`}>
      <h3>{titulo} <b>{items.length}</b></h3>
      {items.map((p, i) => (
        <button key={i} onClick={() => onIr(p)}>
          <span className="ico"><Icon name={tono === "bad" ? "warning" : "info"} size={16} /></span>
          <div><b>{p.titulo}</b><p>{p.detalle}</p></div>
          <Icon name="arrow" size={15} />
        </button>
      ))}
    </section>
  );
}

/** CA-5.2: «Debes corregir» y «Conviene revisar» por separado; cada uno lleva al ramo o campo. */
export function PanelProblemas({ obligatorias, avisos, listo, onIr, onClose }: { obligatorias: Problema[]; avisos: Problema[]; listo: boolean; onIr: (p: Problema) => void; onClose: () => void }) {
  return (
    <Drawer kicker="VALIDACIÓN" titulo="Problemas de la malla" onClose={onClose}>
      {obligatorias.length === 0 && avisos.length === 0 ? (
        <div className="estado-listo"><Icon name="check" size={22} /><div><b>Todo en orden</b><p>No hay problemas ni avisos.</p></div></div>
      ) : (
        <div className={`estado-listo ${obligatorias.length ? "bloqueado" : ""}`}>
          <Icon name={obligatorias.length ? "warning" : "check"} size={22} />
          <div>
            <b>{obligatorias.length ? "Aún hay cosas que corregir" : listo ? "Lista para descargar" : "Sin errores, faltan ramos por revisar"}</b>
            <p>{obligatorias.length ? "Corrige los problemas obligatorios para dejarla correcta." : "Los avisos son cosas para mirar con calma; no impiden descargar."}</p>
          </div>
        </div>
      )}
      <Grupo titulo="Debes corregir" items={obligatorias} tono="bad" onIr={onIr} />
      <Grupo titulo="Conviene revisar" items={avisos} tono="warn" onIr={onIr} />
    </Drawer>
  );
}

/** CA-6.2: advertencias de la IA (resolubles) y notas propias. */
export function PanelNotas({ malla, onAgregar, onAlternar, onEliminar, onClose }: { malla: Malla; onAgregar: (t: string) => void; onAlternar: (id: string) => void; onEliminar: (id: string) => void; onClose: () => void }) {
  const [texto, setTexto] = useState("");
  const ia = malla.notas.filter((n) => n.origen === "ia");
  const mias = malla.notas.filter((n) => n.origen === "curadora");
  const lista = (ns: typeof ia, vacio: string) =>
    ns.length === 0 ? <p className="vacio-txt">{vacio}</p> : (
      <ul className="notas">
        {ns.map((n) => (
          <li key={n.id} className={n.resuelta ? "resuelta" : ""}>
            <label>
              <input type="checkbox" checked={n.resuelta} onChange={() => onAlternar(n.id)} />
              <span>{n.texto}</span>
            </label>
            {n.origen === "curadora" && <button className="icon-button" onClick={() => onEliminar(n.id)} aria-label="Eliminar nota"><Icon name="trash" size={15} /></button>}
          </li>
        ))}
      </ul>
    );
  return (
    <Drawer kicker="NOTAS" titulo="Notas y advertencias" onClose={onClose}>
      <section className="grupo-notas">
        <h3>Lo que dijo la IA <b>{ia.filter((n) => !n.resuelta).length}</b></h3>
        <p className="ayuda">Marca cada nota cuando ya la resolviste. Las que queden sin marcar viajan en el archivo final.</p>
        {lista(ia, "La IA no dejó advertencias.")}
      </section>
      <section className="grupo-notas">
        <h3>Mis notas <b>{mias.filter((n) => !n.resuelta).length}</b></h3>
        {lista(mias, "Aún no escribes notas.")}
        <form onSubmit={(e) => { e.preventDefault(); onAgregar(texto); setTexto(""); }} className="nota-nueva">
          <label className="campo"><span>Agregar una nota</span>
            <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. Falta confirmar el requisito de Química con la secretaría." />
          </label>
          <button className="secondary" type="submit" disabled={!texto.trim()}><Icon name="plus" size={15} /> Agregar nota</button>
        </form>
      </section>
    </Drawer>
  );
}

/** Datos generales de la malla; el año o versión del plan es obligatorio (RN-1). */
export function PanelDatos({ malla, onCambiar, foco, onClose }: { malla: Malla; onCambiar: (c: Partial<Malla>, clave: string) => void; foco: string | null; onClose: () => void }) {
  const f = (k: string) => ({ autoFocus: foco === k, "data-foco": foco === k ? "" : undefined });
  return (
    <Drawer kicker="DATOS GENERALES" titulo="Datos de la malla" onClose={onClose}>
      <label className="campo"><span>Universidad</span>
        <input {...f("universidad")} value={malla.universidad} onChange={(e) => onCambiar({ universidad: e.target.value }, "uni")} />
      </label>
      <label className="campo"><span>Carrera</span>
        <input {...f("carrera")} value={malla.carrera} onChange={(e) => onCambiar({ carrera: e.target.value }, "carrera")} />
      </label>
      <label className="campo"><span>Año o versión del plan</span>
        <input {...f("versionPlan")} value={malla.versionPlan} placeholder="Ej. 2024" onChange={(e) => onCambiar({ versionPlan: e.target.value }, "plan")} />
        <small>Una carrera puede tener mallas de distintos años; esto las distingue.</small>
      </label>
      <div className="dos">
        <label className="campo"><span>Código del programa <em>Opcional</em></span>
          <input value={malla.codigoPrograma} onChange={(e) => onCambiar({ codigoPrograma: e.target.value }, "cod")} />
        </label>
        <label className="campo"><span>Sistema de créditos</span>
          <input value={malla.sistemaCreditos} onChange={(e) => onCambiar({ sistemaCreditos: e.target.value }, "sis")} />
        </label>
      </div>
      <label className="campo"><span>Total de créditos del documento <em>Opcional</em></span>
        <input {...f("totalCreditos")} type="number" min={0} value={malla.totalCreditos ?? ""} onChange={(e) => onCambiar({ totalCreditos: e.target.value === "" ? null : Number(e.target.value) }, "total")} />
        <small>Sirve para avisarte si los créditos de los ramos no cuadran con el total.</small>
      </label>
      <label className="campo"><span>Tu nombre <em>Opcional</em></span>
        <input value={malla.curador} onChange={(e) => onCambiar({ curador: e.target.value }, "curador")} />
        <small>Queda registrado en el archivo final como quien curó la malla.</small>
      </label>
    </Drawer>
  );
}
