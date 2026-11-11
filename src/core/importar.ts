import { mapaRefs, nuevoUid } from "./refs";
import type { Malla, Nota, PrereqEstado, Ramo } from "./types";

/** Error con mensaje listo para mostrar a la curadora (CA-2.3). */
export class ErrorImportacion extends Error {}

const MSG_REGENERAR =
  "Pídele a la IA que vuelva a generar el JSON y pega la respuesta completa otra vez.";

const CLAVES_MALLA = new Set([
  "formato",
  "carrera",
  "universidad",
  "version_plan",
  "codigo_programa",
  "sistema_creditos",
  "total_creditos",
  "semestres",
  "advertencias",
  "curacion",
  "_borrador",
]);

const CLAVES_RAMO = new Set([
  "ref",
  "id",
  "codigo",
  "numero_en_documento",
  "nombre",
  "creditos",
  "sct",
  "prereq_estado",
  "prerrequisitos",
  "semestres_aprobados_requeridos",
  "prereq_texto",
]);

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Saca el JSON de un texto que puede venir con ```json … ``` o con texto antes y después (CA-2.1). */
export function extraerJson(texto: string): unknown {
  const limpio = texto.replace(/^﻿/, "").trim();
  if (!limpio) throw new ErrorImportacion(`No hay nada para cargar. ${MSG_REGENERAR}`);

  const intentos: string[] = [limpio];
  const cerca = limpio.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (cerca) intentos.push(cerca[1].trim());
  const a = limpio.indexOf("{");
  const b = limpio.lastIndexOf("}");
  if (a !== -1 && b > a) intentos.push(limpio.slice(a, b + 1));

  for (const t of intentos) {
    try {
      return JSON.parse(t);
    } catch {
      /* probar el siguiente */
    }
  }
  throw new ErrorImportacion(
    `No pude leer el texto: parece que el JSON está cortado o tiene un error. ${MSG_REGENERAR}`,
  );
}

const texto = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

function numeroONulo(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function estadoDe(v: unknown, tienePrereqs: boolean): PrereqEstado {
  const s = texto(v).toLowerCase().trim();
  if (["ninguno", "none", "no_tiene", "no tiene", "sin_requisitos"].includes(s)) return "ninguno";
  if (["conocido", "yes", "tiene", "known"].includes(s)) return "conocido";
  if (["desconocido", "unknown", "no_se", "no sé", "no se"].includes(s)) return "desconocido";
  return tienePrereqs ? "conocido" : "ninguno";
}

export interface ResumenImportacion {
  carrera: string;
  universidad: string;
  ramos: number;
  semestres: number;
  formatoAntiguo: boolean;
  /** Datos de recuperación si el archivo era un borrador descargable (CA-6.5). */
  eraBorrador: boolean;
}

export interface ResultadoImportacion {
  malla: Malla;
  resumen: ResumenImportacion;
}

/** Convierte un JSON (mallapro-1, formato antiguo o borrador) al modelo interno. */
export function importarMalla(entrada: unknown): ResultadoImportacion {
  if (!esObj(entrada)) {
    throw new ErrorImportacion(`Eso no parece una malla. ${MSG_REGENERAR}`);
  }
  if (!Array.isArray(entrada.semestres)) {
    throw new ErrorImportacion(
      `El texto no trae la lista de semestres (“semestres”), así que no puedo armar la malla. ${MSG_REGENERAR}`,
    );
  }

  const esAntiguo = entrada.formato !== "mallapro-1";
  const ramos: Ramo[] = [];
  const idAntiguo = new Map<string, string>(); // id numérico antiguo → uid
  const pendientes: Array<{ ramo: Ramo; crudos: string[] }> = [];
  let maxSem = 0;

  entrada.semestres.forEach((s, i) => {
    if (!esObj(s)) return;
    const numero = numeroONulo(s.numero) ?? i + 1;
    maxSem = Math.max(maxSem, numero);
    const cursos = Array.isArray(s.cursos) ? s.cursos : [];
    for (const c of cursos) {
      if (!esObj(c)) continue;
      const crudos = Array.isArray(c.prerrequisitos)
        ? c.prerrequisitos.map((p) => texto(p).trim()).filter(Boolean)
        : [];
      const extra: Obj = {};
      for (const [k, v] of Object.entries(c)) if (!CLAVES_RAMO.has(k)) extra[k] = v;
      const ramo: Ramo = {
        uid: nuevoUid(),
        nombre: texto(c.nombre).trim(),
        codigo: texto(c.codigo).trim() || null,
        creditos: numeroONulo(c.creditos ?? c.sct),
        numeroEnDocumento: numeroONulo(c.numero_en_documento),
        semestre: numero,
        prereqEstado: estadoDe(c.prereq_estado, crudos.length > 0),
        prereqs: [],
        prereqsRotos: [],
        semestresAprobados: numeroONulo(c.semestres_aprobados_requeridos),
        prereqTexto: texto(c.prereq_texto).trim() || null,
        revisado: false,
        extra,
      };
      if (esAntiguo && c.id != null) idAntiguo.set(texto(c.id), ramo.uid);
      ramos.push(ramo);
      pendientes.push({ ramo, crudos });
    }
  });

  // Los prerrequisitos se resuelven al final, cuando ya existen todos los ramos (CA-2.2, CA-2.4).
  const hayIdsAntiguos = idAntiguo.size > 0;
  const porRef = mapaRefs({ ramos } as Malla);
  for (const { ramo, crudos } of pendientes) {
    for (const crudo of crudos) {
      const uid =
        (hayIdsAntiguos && idAntiguo.get(crudo)) || porRef.get(crudo.toLowerCase()) || undefined;
      if (uid && uid !== ramo.uid && !ramo.prereqs.includes(uid)) ramo.prereqs.push(uid);
      else if (uid === ramo.uid) ramo.prereqsRotos.push(crudo);
      else if (!uid) ramo.prereqsRotos.push(crudo);
    }
  }

  // Notas: las advertencias de la IA, y si es un borrador, también las de la curadora y su estado.
  const borrador = esObj(entrada._borrador) ? entrada._borrador : null;
  const resueltas = new Set(
    Array.isArray(borrador?.notas_resueltas) ? (borrador.notas_resueltas as unknown[]).map(texto) : [],
  );
  const deCuradora = [...(Array.isArray(borrador?.notas_curadora) ? (borrador.notas_curadora as unknown[]).map(texto) : [])];
  const notas: Nota[] = [];
  if (Array.isArray(entrada.advertencias)) {
    for (const a of entrada.advertencias) {
      const t = texto(a).trim();
      if (!t) continue;
      const idx = deCuradora.indexOf(t);
      if (idx !== -1) deCuradora.splice(idx, 1);
      notas.push({
        id: nuevoUid(),
        texto: t,
        origen: idx !== -1 ? "curadora" : "ia",
        resuelta: resueltas.has(t),
      });
    }
  }

  // Revisados (solo vienen en borradores).
  if (borrador && Array.isArray(borrador.revisados)) {
    const rev = new Set((borrador.revisados as unknown[]).map((x) => texto(x).toLowerCase()));
    const refs = mapaRefs({ ramos } as Malla);
    for (const [ref, uid] of refs) {
      if (rev.has(ref)) {
        const r = ramos.find((x) => x.uid === uid);
        if (r) r.revisado = true;
      }
    }
  }

  const extra: Obj = {};
  for (const [k, v] of Object.entries(entrada)) if (!CLAVES_MALLA.has(k)) extra[k] = v;
  const curacion = esObj(entrada.curacion) ? entrada.curacion : null;

  const malla: Malla = {
    universidad: texto(entrada.universidad).trim(),
    carrera: texto(entrada.carrera).trim(),
    versionPlan: texto(entrada.version_plan).trim(),
    codigoPrograma: texto(entrada.codigo_programa).trim(),
    sistemaCreditos: texto(entrada.sistema_creditos).trim() || "SCT",
    totalCreditos: numeroONulo(entrada.total_creditos),
    numSemestres: Math.max(maxSem, entrada.semestres.length, 1),
    ramos,
    notas,
    curador: texto(curacion?.curador).trim(),
    extra,
  };

  return {
    malla,
    resumen: {
      carrera: malla.carrera || "(sin nombre de carrera)",
      universidad: malla.universidad,
      ramos: ramos.length,
      semestres: malla.numSemestres,
      formatoAntiguo: esAntiguo,
      eraBorrador: borrador !== null,
    },
  };
}

/** Atajo para texto pegado o contenido de un archivo (CA-2.1 a CA-2.3). */
export function importarTexto(contenido: string): ResultadoImportacion {
  return importarMalla(extraerJson(contenido));
}

/** CA-2.5: malla vacía con 8 semestres. */
export function mallaVacia(): Malla {
  return {
    universidad: "",
    carrera: "",
    versionPlan: "",
    codigoPrograma: "",
    sistemaCreditos: "SCT",
    totalCreditos: null,
    numSemestres: 8,
    ramos: [],
    notas: [],
    curador: "",
    extra: {},
  };
}
