import {
  CLAVE_SEED_ADMINISTRATIVOS,
  CLAVE_SEED_COMERCIALES,
  PLANTILLAS_SEED,
  buildSeedInsertPayload,
} from './plantillas-seed';
import { plainTextFromTipTapDoc } from '../utils/tiptap-plain-text';
import { Types } from 'mongoose';

function collectBoldTexts(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as Record<string, unknown>;
  if (
    n.type === 'text' &&
    typeof n.text === 'string' &&
    Array.isArray(n.marks) &&
    n.marks.some(
      (m) => m && typeof m === 'object' && (m as { type?: string }).type === 'bold',
    )
  ) {
    out.push(n.text);
  }
  if (Array.isArray(n.content)) {
    for (const child of n.content) collectBoldTexts(child, out);
  }
  return out;
}

describe('PLANTILLAS_SEED content', () => {
  it('expone exactamente las dos claveSeed canónicas', () => {
    expect(PLANTILLAS_SEED).toHaveLength(2);
    expect(PLANTILLAS_SEED.map((s) => s.claveSeed).sort()).toEqual(
      [CLAVE_SEED_ADMINISTRATIVOS, CLAVE_SEED_COMERCIALES].sort(),
    );
  });

  it('comerciales y administrativos tienen 4 secciones richtext con títulos acordados', () => {
    const comerciales = PLANTILLAS_SEED.find(
      (s) => s.claveSeed === CLAVE_SEED_COMERCIALES,
    );
    const administrativos = PLANTILLAS_SEED.find(
      (s) => s.claveSeed === CLAVE_SEED_ADMINISTRATIVOS,
    );
    expect(comerciales?.nombre).toBe('Requerimientos Comerciales');
    expect(administrativos?.nombre).toBe('Requerimientos Administrativos');
    expect(comerciales?.secciones.map((s) => s.titulo)).toEqual([
      'Alcance',
      'Precios e Impuestos',
      'Entrega de productos',
      'Programación de Servicios',
    ]);
    expect(administrativos?.secciones.map((s) => s.titulo)).toEqual([
      'Confirmación del pedido',
      'Anticipo y condiciones de pago',
      'Crédito',
      'Facturación',
    ]);
    for (const seed of PLANTILLAS_SEED) {
      for (const sec of seed.secciones) {
        expect(sec.tipo).toBe('richtext');
        if (sec.tipo !== 'richtext') continue;
        expect(sec.cuerpo.doc).toBeTruthy();
        expect(sec.cuerpo.text).toBe(plainTextFromTipTapDoc(sec.cuerpo.doc));
        expect(sec.cuerpo.text.length).toBeGreaterThan(40);
      }
    }
  });

  it('marca en negrita las cantidades editables en su sección', () => {
    const byTitulo = new Map<string, string[]>();
    for (const seed of PLANTILLAS_SEED) {
      for (const sec of seed.secciones) {
        if (sec.tipo !== 'richtext' || !sec.titulo) continue;
        byTitulo.set(sec.titulo, collectBoldTexts(sec.cuerpo.doc));
      }
    }
    expect(byTitulo.get('Anticipo y condiciones de pago')).toEqual(['50%']);
    expect(byTitulo.get('Crédito')).toEqual(['15 días naturales']);
    expect(byTitulo.get('Entrega de productos')).toEqual(['48 horas']);
    expect(byTitulo.get('Programación de Servicios')).toEqual([
      '7 días hábiles',
    ]);
  });

  it('buildSeedInsertPayload clona secciones (no comparte referencia del módulo)', () => {
    const seed = PLANTILLAS_SEED[0];
    const payload = buildSeedInsertPayload(new Types.ObjectId(), seed);
    expect(payload.secciones).not.toBe(seed.secciones);
    expect(payload.secciones[0]).not.toBe(seed.secciones[0]);
    (payload.secciones[0] as { titulo?: string }).titulo = 'MUTATED';
    expect(seed.secciones[0].titulo).not.toBe('MUTATED');
  });
});
