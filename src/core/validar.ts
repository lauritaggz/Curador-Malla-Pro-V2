import { refBase, etiquetaRamo } from "./refs";
import { tieneRequisitos } from "./operaciones";
import type { Malla, Problema } from "./types";

/**
 * Reglas V-01 a V-15 de la HU. Función pura: la misma malla da siempre los mismos problemas,
 * así se recalculan en tiempo real (CA-5.4) sin estado oculto.
 */
export function validar(malla: Malla): Problema[] {
  const p: Problema[] = [];
  const obligatoria = (x: Omit<Problema, "nivel">) => p.push({ ...x, nivel: "obligatoria" });
  const aviso = (x: Omit<Problema, "nivel">) => p.push({ ...x, nivel: "aviso" });

  // V-01
  if (!malla.universidad.trim())
    obligatoria({ regla: "V-01", titulo: "Falta la universidad", detalle: "Escribe el nombre de la universidad en los datos de la malla.", campo: "general", campoMalla: "universidad" });
  if (!malla.carrera.trim())
    obligatoria({ regla: "V-01", titulo: "Falta la carrera", detalle: "Escribe el nombre de la carrera en los datos de la malla.", campo: "general", campoMalla: "carrera" });
  if (!malla.versionPlan.trim())
    obligatoria({ regla: "V-01", titulo: "Falta el año o versión del plan", detalle: "Una carrera puede tener varias mallas según el año del plan. Indica cuál es esta (por ejemplo, 2024).", campo: "general", campoMalla: "versionPlan" });

  // V-02
  if (malla.ramos.length === 0)
    obligatoria({ regla: "V-02", titulo: "La malla no tiene ramos", detalle: "Agrega al menos un ramo para poder descargarla.", campo: "general" });

  const porUid = new Map(malla.ramos.map((r) => [r.uid, r]));

  // V-04: referencias repetidas (sin distinguir mayúsculas)
  const vistas = new Map<string, string[]>();
  for (const r of malla.ramos) {
    const base = refBase(r).toLowerCase();
    if (!base) continue;
    vistas.set(base, [...(vistas.get(base) ?? []), r.uid]);
  }

  for (const r of malla.ramos) {
    const nom = r.nombre.trim() || "Ramo sin nombre";
    // V-03
    if (!r.nombre.trim())
      obligatoria({ regla: "V-03", titulo: "Ramo sin nombre", detalle: `Hay un ramo del semestre ${r.semestre} sin nombre.`, uid: r.uid, campo: "nombre" });

    // V-04
    const base = refBase(r);
    if (base && (vistas.get(base.toLowerCase())?.length ?? 0) > 1)
      obligatoria({ regla: "V-04", titulo: "Código repetido", detalle: `El código «${base}» aparece en más de un ramo (${nom}).`, uid: r.uid, campo: "codigo" });

    // V-05
    for (const roto of r.prereqsRotos)
      obligatoria({ regla: "V-05", titulo: "Prerrequisito que no existe", detalle: `${nom} pide «${roto}», que no existe en la malla.`, uid: r.uid, campo: "prereqs" });

    // V-06
    for (const pu of r.prereqs) {
      const pr = porUid.get(pu);
      if (!pr) continue;
      if (pr.semestre === r.semestre)
        obligatoria({ regla: "V-06", titulo: "Prerrequisito en el mismo semestre", detalle: `${nom} y su requisito «${etiquetaRamo(pr)}» están en el semestre ${r.semestre}.`, uid: r.uid, campo: "prereqs" });
      else if (pr.semestre > r.semestre)
        obligatoria({ regla: "V-06", titulo: "Prerrequisito en un semestre posterior", detalle: `${nom} (semestre ${r.semestre}) pide «${etiquetaRamo(pr)}», que está en el semestre ${pr.semestre}.`, uid: r.uid, campo: "prereqs" });
    }

    // V-08
    if (r.creditos == null)
      aviso({ regla: "V-08", titulo: "Créditos sin definir", detalle: `${nom} no tiene créditos.`, uid: r.uid, campo: "creditos" });

    // V-09
    if (r.prereqEstado === "desconocido")
      aviso({ regla: "V-09", titulo: "Prerrequisitos desconocidos", detalle: `No se sabe si ${nom} tiene prerrequisitos. Revísalo en el documento.`, uid: r.uid, campo: "estado" });

    // V-10
    if (r.prereqEstado === "conocido" && !tieneRequisitos(r))
      aviso({ regla: "V-10", titulo: "Dice tener requisitos, pero no hay ninguno", detalle: `${nom} está marcado como «Tiene», pero no tiene ramos ni semestres requeridos. Si el requisito es «A o B», déjalo en el texto original.`, uid: r.uid, campo: "prereqs" });

    // V-11
    if (r.prereqEstado === "ninguno" && tieneRequisitos(r))
      aviso({ regla: "V-11", titulo: "Dice sin requisitos pero tiene", detalle: `${nom} está marcado como «No tiene», pero tiene requisitos cargados.`, uid: r.uid, campo: "estado" });

    // V-12
    if (!r.codigo?.trim())
      aviso({ regla: "V-12", titulo: "Ramo sin código", detalle: r.numeroEnDocumento != null ? `${nom} usará el número ${r.numeroEnDocumento} como referencia.` : `${nom} no tiene código ni número en el documento.`, uid: r.uid, campo: "codigo" });
  }

  // V-07: ciclos (DFS iterativa con colores)
  const color = new Map<string, 0 | 1 | 2>();
  const enCiclo = new Set<string>();
  const visitar = (inicio: string) => {
    const pila: Array<{ uid: string; i: number }> = [{ uid: inicio, i: 0 }];
    const camino: string[] = [inicio];
    color.set(inicio, 1);
    while (pila.length) {
      const tope = pila[pila.length - 1];
      const deps = porUid.get(tope.uid)?.prereqs ?? [];
      if (tope.i >= deps.length) {
        color.set(tope.uid, 2);
        pila.pop();
        camino.pop();
        continue;
      }
      const sig = deps[tope.i++];
      if (!porUid.has(sig)) continue;
      const c = color.get(sig) ?? 0;
      if (c === 1) {
        for (const u of camino.slice(camino.indexOf(sig))) enCiclo.add(u);
      } else if (c === 0) {
        color.set(sig, 1);
        pila.push({ uid: sig, i: 0 });
        camino.push(sig);
      }
    }
  };
  for (const r of malla.ramos) if (!color.has(r.uid)) visitar(r.uid);
  if (enCiclo.size) {
    const nombres = [...enCiclo].map((u) => porUid.get(u)?.nombre || "Sin nombre");
    const primero = [...enCiclo][0];
    obligatoria({ regla: "V-07", titulo: "Requisitos en círculo", detalle: `Estos ramos se piden entre sí: ${nombres.join(", ")}.`, uid: primero, campo: "prereqs" });
  }

  // V-13
  if (malla.totalCreditos != null && malla.ramos.length > 0) {
    const suma = malla.ramos.reduce((a, r) => a + (r.creditos ?? 0), 0);
    if (suma !== malla.totalCreditos)
      aviso({ regla: "V-13", titulo: "Los créditos no cuadran", detalle: `Los ramos suman ${suma} y el total indicado es ${malla.totalCreditos}.`, campo: "general", campoMalla: "totalCreditos" });
  }

  // V-14
  for (let s = 1; s <= malla.numSemestres; s++)
    if (!malla.ramos.some((r) => r.semestre === s))
      aviso({ regla: "V-14", titulo: "Semestre vacío", detalle: `El semestre ${s} no tiene ramos.`, campo: "semestre" });

  // V-15
  const sinResolver = malla.notas.filter((n) => n.origen === "ia" && !n.resuelta).length;
  if (sinResolver > 0)
    aviso({ regla: "V-15", titulo: "Notas de la IA sin revisar", detalle: sinResolver === 1 ? "Hay 1 nota de la IA sin resolver." : `Hay ${sinResolver} notas de la IA sin resolver.`, campo: "general" });

  return p;
}

export interface ResumenProblemas {
  obligatorias: Problema[];
  avisos: Problema[];
  /** Problemas por ramo, para marcar las tarjetas. */
  porRamo: Map<string, Problema[]>;
}

export function resumirProblemas(problemas: Problema[]): ResumenProblemas {
  const porRamo = new Map<string, Problema[]>();
  for (const x of problemas) {
    if (!x.uid) continue;
    porRamo.set(x.uid, [...(porRamo.get(x.uid) ?? []), x]);
  }
  return {
    obligatorias: problemas.filter((x) => x.nivel === "obligatoria"),
    avisos: problemas.filter((x) => x.nivel === "aviso"),
    porRamo,
  };
}
