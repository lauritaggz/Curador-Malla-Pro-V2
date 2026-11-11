/** Modelo interno del curador. Nada de esto se exporta tal cual: ver exportar.ts (RN-3). */

export type PrereqEstado = "ninguno" | "conocido" | "desconocido";

export interface Ramo {
  /** Identificador interno estable (RN-3). Nunca se exporta. */
  uid: string;
  nombre: string;
  codigo: string | null;
  creditos: number | null;
  numeroEnDocumento: number | null;
  /** Número del semestre en el que está (1..numSemestres). */
  semestre: number;
  prereqEstado: PrereqEstado;
  /** Prerrequisitos que existen en la malla, por uid. Todos se exigen («Y», RN-4). */
  prereqs: string[];
  /** Prerrequisitos que no coinciden con ningún ramo (se muestran en rojo, V-05). */
  prereqsRotos: string[];
  semestresAprobados: number | null;
  prereqTexto: string | null;
  /** Interno: la curadora ya lo revisó. Nunca se exporta en el JSON final. */
  revisado: boolean;
  /** Campos desconocidos del ramo, conservados tal cual (RN-6). */
  extra: Record<string, unknown>;
}

export interface Nota {
  id: string;
  texto: string;
  origen: "ia" | "curadora";
  resuelta: boolean;
}

export interface Malla {
  universidad: string;
  carrera: string;
  versionPlan: string;
  codigoPrograma: string;
  sistemaCreditos: string;
  totalCreditos: number | null;
  numSemestres: number;
  /** El orden del arreglo define el orden dentro de cada semestre. */
  ramos: Ramo[];
  notas: Nota[];
  curador: string;
  /** Campos desconocidos de la malla, conservados tal cual (RN-6). */
  extra: Record<string, unknown>;
}

export type NivelProblema = "obligatoria" | "aviso";

export type CampoProblema =
  | "nombre"
  | "codigo"
  | "creditos"
  | "semestre"
  | "prereqs"
  | "estado"
  | "general";

export interface Problema {
  /** V-01 … V-15 (ver HU). */
  regla: string;
  nivel: NivelProblema;
  titulo: string;
  detalle: string;
  /** Ramo afectado, si aplica. */
  uid?: string;
  campo?: CampoProblema;
  /** Para problemas de datos generales. */
  campoMalla?: "universidad" | "carrera" | "versionPlan" | "totalCreditos";
}

export const ESTADO_ETIQUETA: Record<PrereqEstado, string> = {
  ninguno: "No tiene",
  conocido: "Tiene",
  desconocido: "No sé",
};
