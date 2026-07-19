import { Types } from 'mongoose';
import { SeccionPlantillaV1 } from '../schemas/plantilla.schema';

export const CLAVE_SEED_COMERCIALES = 'requerimientos-comerciales';
export const CLAVE_SEED_ADMINISTRATIVOS = 'requerimientos-administrativos';

export interface PlantillaSeedDef {
  claveSeed: typeof CLAVE_SEED_COMERCIALES | typeof CLAVE_SEED_ADMINISTRATIVOS;
  nombre: string;
  secciones: SeccionPlantillaV1[];
}

function seedSeccionId(suffix: string): string {
  // IDs estables para seeds (no ObjectId) — tipado string libre
  return `seed-${suffix}`;
}

/** Contenido de ejemplo breve (FR-51 / copy diferido). */
export const PLANTILLAS_SEED: readonly PlantillaSeedDef[] = [
  {
    claveSeed: CLAVE_SEED_COMERCIALES,
    nombre: 'Requerimientos Comerciales',
    secciones: [
      {
        id: seedSeccionId('comerciales-1'),
        tipo: 'richtext',
        titulo: 'Condiciones comerciales',
        cuerpo: {
          text: 'Ejemplo: tiempos de entrega, alcance del servicio y condiciones comerciales.',
        },
      },
    ],
  },
  {
    claveSeed: CLAVE_SEED_ADMINISTRATIVOS,
    nombre: 'Requerimientos Administrativos',
    secciones: [
      {
        id: seedSeccionId('administrativos-1'),
        tipo: 'tabla',
        titulo: 'Documentación',
        encabezados: ['Documento', 'Requerido'],
        filas: [
          ['Orden de compra (OC)', 'Sí'],
          ['RFC / constancia fiscal', 'Sí'],
          ['Datos de facturación', 'Sí'],
        ],
      },
    ],
  },
] as const;

export function buildSeedInsertPayload(
  tenantId: Types.ObjectId,
  seed: PlantillaSeedDef,
) {
  return {
    tenantId,
    claveSeed: seed.claveSeed,
    nombre: seed.nombre,
    schemaVersion: 1 as const,
    secciones: seed.secciones,
    activo: true,
  };
}
