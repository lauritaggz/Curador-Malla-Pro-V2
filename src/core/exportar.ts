import { ramoPorUid, refBase, refDe } from "./refs";
import type { Malla, Ramo } from "./types";

type Obj = Record<string, unknown>;

export interface OpcionesExportar {
  /** Fecha ISO (AAAA-MM-DD). Se inyecta para poder probar. */
  fecha?: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);

function ramoAJson(r: Ramo, malla: Malla): Obj {
  const refs = r.prereqs.map((u) => {
    const pr = ramoPorUid(malla, u);
    return pr ? refDe(pr, malla) : null;
  });
  return {
    ref: refDe(r, malla),
    codigo: r.codigo?.trim() || null,
    numero_en_documento: r.numeroEnDocumento,
    nombre: r.nombre.trim(),
    creditos: r.creditos,
    prereq_estado: r.prereqEstado,
    prerrequisitos: [...refs.filter((x): x is string => x !== null), ...r.prereqsRotos],
    semestres_aprobados_requeridos: r.semestresAprobados,
    prereq_texto: r.prereqTexto?.trim() || null,
    ...r.extra, // RN-6: campos desconocidos tal cual
  };
}

function semestresAJson(malla: Malla): Obj[] {
  return Array.from({ length: malla.numSemestres }, (_, i) => {
    const numero = i + 1;
    return {
      numero,
      cursos: malla.ramos.filter((r) => r.semestre === numero).map((r) => ramoAJson(r, malla)),
    };
  });
}

/** CA-7.3: JSON final mallapro-1, sin uid ni revisado, con las notas sin resolver en «advertencias». */
export function exportarFinal(malla: Malla, op: OpcionesExportar = {}): Obj {
  const revisados = malla.ramos.filter((r) => r.revisado).length;
  return {
    formato: "mallapro-1",
    carrera: malla.carrera.trim(),
    universidad: malla.universidad.trim(),
    version_plan: malla.versionPlan.trim(),
    codigo_programa: malla.codigoPrograma.trim() || null,
    sistema_creditos: malla.sistemaCreditos.trim() || "SCT",
    total_creditos: malla.totalCreditos,
    semestres: semestresAJson(malla),
    advertencias: malla.notas.filter((n) => !n.resuelta).map((n) => n.texto),
    curacion: {
      curador: malla.curador.trim() || null,
      fecha: op.fecha ?? hoy(),
      ramos_revisados: revisados,
      ramos_totales: malla.ramos.length,
    },
    ...malla.extra,
  };
}

/** CA-6.5: borrador descargable. Igual al final, más `_borrador` con revisados y notas resueltas. */
export function exportarBorrador(malla: Malla, op: OpcionesExportar = {}): Obj {
  const base = exportarFinal(malla, op);
  return {
    ...base,
    advertencias: malla.notas.map((n) => n.texto),
    _borrador: {
      revisados: malla.ramos.filter((r) => r.revisado && refBase(r)).map((r) => refBase(r).toLowerCase()),
      notas_resueltas: malla.notas.filter((n) => n.resuelta).map((n) => n.texto),
      notas_curadora: malla.notas.filter((n) => n.origen === "curadora").map((n) => n.texto),
    },
  };
}

export const aTexto = (o: Obj): string => JSON.stringify(o, null, 2) + "\n";

/** Quita lo que no sirve en un nombre de archivo. */
function limpiar(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sin-nombre"
  );
}

/** CA-7.1: universidad_carrera_plan.json */
export function nombreArchivo(malla: Malla, borrador = false): string {
  const base = [malla.universidad, malla.carrera, malla.versionPlan].map(limpiar).join("_");
  return `${base}${borrador ? "_borrador" : ""}.json`;
}
