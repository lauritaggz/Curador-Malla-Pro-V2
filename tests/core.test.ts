import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import schema from "../src/core/mallapro-1.schema.json";
import { importarMalla, importarTexto, mallaVacia, ErrorImportacion } from "../src/core/importar";
import { validar } from "../src/core/validar";
import { exportarBorrador, exportarFinal, nombreArchivo } from "../src/core/exportar";
import * as op from "../src/core/operaciones";
import { aplicar, crearHistorial, deshacer, rehacer, MAX_PASOS } from "../src/core/historial";
import type { Malla } from "../src/core/types";

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");
const ajv = new Ajv({ allErrors: true });
const validaEsquema = ajv.compile(schema);

const cargar = (n: string) => importarTexto(fx(n)).malla;
const reglas = (m: Malla) => validar(m).map((p) => p.regla);
const porCodigo = (m: Malla, c: string) => m.ramos.find((r) => r.codigo === c)!;

/** Malla correcta mínima para ir rompiéndola regla por regla. */
function base(): Malla {
  const m = cargar("malla-ejemplo.json");
  return { ...m, versionPlan: "2024", totalCreditos: null, notas: [] };
}

describe("CA-2 importación", () => {
  it("CA-2.1 acepta mallapro-1 y texto envuelto en ```json con texto alrededor", () => {
    const envuelto = "Aquí está tu malla:\n```json\n" + fx("malla-ejemplo.json") + "\n```\nListo.";
    const { malla, resumen } = importarTexto(envuelto);
    expect(resumen.ramos).toBe(8);
    expect(resumen.semestres).toBe(3);
    expect(malla.carrera).toContain("Industrial");
    // sin vallas, solo con texto antes y después
    expect(importarTexto("Hola " + fx("malla-ejemplo.json") + " chao").resumen.ramos).toBe(8);
  });

  it("CA-2.2 formato antiguo: convierte id/sct sin perder prerrequisitos y conserva area", () => {
    const { malla, resumen } = importarTexto(fx("industrial-formato-antiguo.json"));
    expect(resumen.formatoAntiguo).toBe(true);
    const conPrereq = malla.ramos.filter((r) => r.prereqs.length > 0);
    expect(conPrereq.length).toBeGreaterThan(0);
    expect(malla.ramos.every((r) => r.prereqsRotos.length === 0)).toBe(true);
    expect(malla.ramos[0].creditos).toBe(18);
    expect(malla.ramos[0].extra.area).toBe("fisica");
    const salida = exportarFinal(malla) as any;
    expect(salida.formato).toBe("mallapro-1");
    expect(salida.semestres[0].cursos[0].area).toBe("fisica");
  });

  it("CA-2.3 JSON inválido da un mensaje simple", () => {
    expect(() => importarTexto('{"carrera": "x",')).toThrow(ErrorImportacion);
    expect(() => importarTexto('{"carrera": "x"}')).toThrow(/semestres/);
    expect(() => importarTexto("")).toThrow(ErrorImportacion);
  });

  it("CA-2.4 prerrequisito inexistente queda marcado y cuenta como obligatorio", () => {
    const json = JSON.parse(fx("malla-ejemplo.json"));
    json.semestres[1].cursos[0].prerrequisitos = ["NOEXISTE"];
    const m = importarMalla(json).malla;
    expect(m.ramos.find((r) => r.codigo === "MAT201")!.prereqsRotos).toEqual(["NOEXISTE"]);
    expect(validar(m).some((p) => p.regla === "V-05" && p.nivel === "obligatoria")).toBe(true);
  });

  it("CA-2.5 malla vacía parte con 8 semestres", () => {
    expect(mallaVacia().numSemestres).toBe(8);
  });
});

describe("Validaciones V-01 a V-15", () => {
  it("la malla base de pruebas no tiene problemas obligatorios", () => {
    expect(validar(base()).filter((p) => p.nivel === "obligatoria")).toEqual([]);
  });

  it("V-01 falta universidad, carrera o año del plan", () => {
    const m = base();
    expect(reglas({ ...m, versionPlan: "" })).toContain("V-01");
    expect(reglas({ ...m, universidad: " " })).toContain("V-01");
    expect(reglas({ ...m, carrera: "" })).toContain("V-01");
  });

  it("V-02 sin ramos", () => expect(reglas({ ...base(), ramos: [] })).toContain("V-02"));

  it("V-03 ramo sin nombre", () => {
    const m = base();
    expect(reglas(op.actualizarRamo(m, m.ramos[0].uid, { nombre: "" }))).toContain("V-03");
  });

  it("V-04 código repetido sin distinguir mayúsculas", () => {
    const m = base();
    const r = op.actualizarRamo(m, porCodigo(m, "MAT102").uid, { codigo: "mat101" });
    expect(reglas(r)).toContain("V-04");
  });

  it("V-05 prerrequisito inexistente", () => {
    const m = base();
    const r = op.actualizarRamo(m, porCodigo(m, "MAT201").uid, { prereqsRotos: ["ZZZ"] });
    expect(reglas(r)).toContain("V-05");
  });

  it("V-06 prerrequisito en el mismo semestre o posterior", () => {
    const m = base();
    const mismo = op.agregarPrereq(m, porCodigo(m, "MAT101").uid, porCodigo(m, "MAT102").uid);
    expect(reglas(mismo)).toContain("V-06");
    const posterior = op.agregarPrereq(m, porCodigo(m, "MAT101").uid, porCodigo(m, "IND301").uid);
    expect(validar(posterior).some((p) => p.regla === "V-06" && /posterior/.test(p.titulo))).toBe(true);
  });

  it("V-07 ciclo de prerrequisitos", () => {
    const m = base();
    const a = porCodigo(m, "MAT201").uid;
    const b = porCodigo(m, "IND301").uid;
    const ciclo = op.agregarPrereq(m, a, b); // MAT201 -> IND301 -> MAT201
    expect(reglas(ciclo)).toContain("V-07");
    expect(reglas(m)).not.toContain("V-07");
  });

  it("V-08 créditos vacíos", () => expect(reglas(base())).toContain("V-08")); // el ramo 3 no tiene

  it("V-09 estado No sé", () => expect(reglas(base())).toContain("V-09"));

  it("V-10 dice Tiene sin ramos ni semestres", () => {
    expect(reglas(base())).toContain("V-10"); // IND201: «A o B» solo en texto
  });

  it("V-11 dice No tiene pero tiene requisitos", () => {
    const m = base();
    const r = op.cambiarEstado(m, porCodigo(m, "MAT201").uid, "ninguno");
    expect(reglas(r)).toContain("V-11");
  });

  it("V-12 ramo sin código", () => expect(reglas(base())).toContain("V-12"));

  it("V-13 la suma de créditos no coincide con el total", () => {
    expect(reglas({ ...base(), totalCreditos: 999 })).toContain("V-13");
    const suma = base().ramos.reduce((a, r) => a + (r.creditos ?? 0), 0);
    expect(reglas({ ...base(), totalCreditos: suma })).not.toContain("V-13");
  });

  it("V-14 semestre vacío", () => expect(reglas(op.agregarSemestre(base()))).toContain("V-14"));

  it("V-15 notas de la IA sin resolver", () => {
    const m = importarTexto(fx("malla-ejemplo.json")).malla;
    expect(reglas(m)).toContain("V-15");
    const resueltas = { ...m, notas: m.notas.map((n) => ({ ...n, resuelta: true })) };
    expect(reglas(resueltas)).not.toContain("V-15");
  });
});

describe("Edición", () => {
  it("CA-3.1 mover ramos entre y dentro de semestres", () => {
    let m = base();
    const uid = porCodigo(m, "IND301").uid;
    m = op.moverRamo(m, uid, 1, 0);
    expect(m.ramos.filter((r) => r.semestre === 1)[0].uid).toBe(uid);
    m = op.moverRamo(m, uid, 1, 99);
    const s1 = m.ramos.filter((r) => r.semestre === 1);
    expect(s1[s1.length - 1].uid).toBe(uid);
    m = op.moverDentro(m, uid, -1);
    const s1b = m.ramos.filter((r) => r.semestre === 1);
    expect(s1b[s1b.length - 2].uid).toBe(uid);
    expect(m.ramos).toHaveLength(8);
  });

  it("CA-3.1 mover a un semestre vacío", () => {
    let m = op.agregarSemestre(base());
    const uid = m.ramos[0].uid;
    m = op.moverRamo(m, uid, 4, 0);
    expect(m.ramos.find((r) => r.uid === uid)!.semestre).toBe(4);
  });

  it("CA-3.3 eliminar un ramo lo quita de los prerrequisitos de otros", () => {
    const m = base();
    const mat101 = porCodigo(m, "MAT101").uid;
    const r = op.eliminarRamo(m, mat101);
    expect(r.ramos.some((x) => x.prereqs.includes(mat101))).toBe(false);
  });

  it("CA-3.3 solo se elimina un semestre vacío", () => {
    const m = base();
    expect(op.eliminarSemestre(m, 1)).toBe(m);
    const conVacio = op.agregarSemestre(m);
    expect(op.eliminarSemestre(conVacio, 4).numSemestres).toBe(3);
  });

  it("CA-4.2 agregar un prerrequisito pasa el estado a Tiene", () => {
    const m = base();
    const r = op.agregarPrereq(m, porCodigo(m, "MAT102").uid, porCodigo(m, "MAT101").uid);
    expect(r.ramos.find((x) => x.codigo === "MAT102")!.prereqEstado).toBe("conocido");
  });

  it("CA-4.3 cambiar el código no rompe los prerrequisitos (RN-3)", () => {
    const m = base();
    const mat101 = porCodigo(m, "MAT101");
    const r = op.actualizarRamo(m, mat101.uid, { codigo: "NUEVO1" });
    const salida = exportarFinal(r) as any;
    const mat201 = salida.semestres[1].cursos[0];
    expect(mat201.prerrequisitos).toEqual(["NUEVO1"]);
    expect(reglas(r)).not.toContain("V-05");
  });

  it("CA-4.4 pasar a No tiene puede limpiar requisitos", () => {
    const m = base();
    const uid = porCodigo(m, "FIS101").uid;
    const r = op.cambiarEstado(m, uid, "ninguno", true);
    const f = r.ramos.find((x) => x.uid === uid)!;
    expect(f.prereqs).toEqual([]);
    expect(f.prereqEstado).toBe("ninguno");
  });

  it("CA-4.5 el siguiente sin revisar salta los revisados", () => {
    let m = base();
    m = op.actualizarRamo(m, m.ramos[1].uid, { revisado: true });
    expect(op.siguienteSinRevisar(m, m.ramos[0].uid)!.uid).toBe(m.ramos[2].uid);
    const todos = { ...m, ramos: m.ramos.map((r) => ({ ...r, revisado: true })) };
    expect(op.siguienteSinRevisar(todos, todos.ramos[0].uid)).toBeUndefined();
  });

  it("CA-6.4 deshacer y rehacer, al menos 100 pasos", () => {
    let h = crearHistorial(0);
    for (let i = 1; i <= 150; i++) h = aplicar(h, i);
    expect(h.pasado.length).toBeGreaterThanOrEqual(100);
    expect(h.pasado.length).toBeLessThanOrEqual(MAX_PASOS);
    for (let i = 0; i < 100; i++) h = deshacer(h);
    expect(h.presente).toBe(50);
    h = rehacer(h);
    expect(h.presente).toBe(51);
  });
});

describe("CA-7 exportación", () => {
  it("CA-7.3 cumple el esquema y no filtra datos internos", () => {
    for (const n of ["malla-ejemplo.json", "industrial-formato-antiguo.json"]) {
      const m = { ...cargar(n), versionPlan: "2024" };
      const salida = exportarFinal(m, { fecha: "2026-11-11" });
      expect(validaEsquema(salida), JSON.stringify(validaEsquema.errors)).toBe(true);
      const texto = JSON.stringify(salida);
      expect(texto).not.toContain('"uid"');
      expect(texto).not.toContain('"revisado"');
      expect(texto).not.toContain("_borrador");
    }
  });

  it("CA-7.3 las notas sin resolver salen en advertencias", () => {
    const m = cargar("malla-ejemplo.json");
    m.notas[0] = { ...m.notas[0], resuelta: true };
    const salida = exportarFinal(m) as any;
    expect(salida.advertencias).toHaveLength(m.notas.length - 1);
  });

  it("CA-7.4 ida y vuelta: ramos, semestres y prerrequisitos idénticos", () => {
    for (const n of ["malla-ejemplo.json", "industrial-formato-antiguo.json"]) {
      const m1 = { ...cargar(n), versionPlan: "2024" };
      const a = exportarFinal(m1, { fecha: "2026-11-11" }) as any;
      const m2 = importarTexto(JSON.stringify(a)).malla;
      const b = exportarFinal(m2, { fecha: "2026-11-11" }) as any;
      expect(b.semestres).toEqual(a.semestres);
      expect(b.carrera).toBe(a.carrera);
      expect(b.advertencias).toEqual(a.advertencias);
    }
  });

  it("CA-6.5 el borrador recupera revisados y notas resueltas", () => {
    let m = cargar("malla-ejemplo.json");
    m = op.actualizarRamo(m, porCodigo(m, "MAT101").uid, { revisado: true });
    m = op.alternarNota(m, m.notas[0].id);
    m = op.agregarNota(m, "Falta confirmar con la secretaría");
    const m2 = importarTexto(JSON.stringify(exportarBorrador(m))).malla;
    expect(porCodigo(m2, "MAT101").revisado).toBe(true);
    expect(porCodigo(m2, "MAT102").revisado).toBe(false);
    expect(m2.notas[0].resuelta).toBe(true);
    expect(m2.notas.at(-1)!.origen).toBe("curadora");
    expect(m2.notas).toHaveLength(m.notas.length);
  });

  it("CA-7.1 nombre de archivo universidad_carrera_plan.json", () => {
    const m = { ...base(), universidad: "Universidad de Chile", carrera: "Bioquímica", versionPlan: "2024" };
    expect(nombreArchivo(m)).toBe("universidad-de-chile_bioquimica_2024.json");
  });

  it("RN-2 sin código, la referencia es el número en el documento", () => {
    const m = base();
    const salida = exportarFinal(m) as any;
    const sinCodigo = salida.semestres[0].cursos[2];
    expect(sinCodigo.codigo).toBeNull();
    expect(sinCodigo.ref).toBe("3");
  });
});
