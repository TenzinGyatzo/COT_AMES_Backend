import { Types } from 'mongoose';
import { SeccionPlantillaV1 } from '../schemas/plantilla.schema';
import { plainTextFromTipTapDoc } from '../utils/tiptap-plain-text';

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

type TipTapTextNode = {
  type: 'text';
  text: string;
  marks?: Array<{ type: string }>;
};

type TipTapParagraph = {
  type: 'paragraph';
  content: TipTapTextNode[];
};

type TipTapDoc = {
  type: 'doc';
  content: TipTapParagraph[];
};

function textNode(text: string, bold = false): TipTapTextNode {
  if (bold) {
    return { type: 'text', text, marks: [{ type: 'bold' }] };
  }
  return { type: 'text', text };
}

/** Fragmentos: string plano o `{ t, bold? }`. */
type InlinePart = string | { t: string; bold?: boolean };

function paragraph(...parts: InlinePart[]): TipTapParagraph {
  const content: TipTapTextNode[] = parts.map((p) =>
    typeof p === 'string' ? textNode(p) : textNode(p.t, Boolean(p.bold)),
  );
  return { type: 'paragraph', content };
}

function richtextSeccion(
  idSuffix: string,
  titulo: string,
  paragraphs: TipTapParagraph[],
): SeccionPlantillaV1 {
  const doc: TipTapDoc = { type: 'doc', content: paragraphs };
  return {
    id: seedSeccionId(idSuffix),
    tipo: 'richtext',
    titulo,
    cuerpo: {
      text: plainTextFromTipTapDoc(doc),
      doc,
    },
  };
}

/** Contenido genérico usable al onboard (tenants nuevos; `$setOnInsert`). */
export const PLANTILLAS_SEED: readonly PlantillaSeedDef[] = [
  {
    claveSeed: CLAVE_SEED_COMERCIALES,
    nombre: 'Requerimientos Comerciales',
    secciones: [
      richtextSeccion('comerciales-alcance', 'Alcance', [
        paragraph(
          'La propuesta incluye únicamente los productos, servicios, cantidades y entregables descritos en la cotización.',
        ),
        paragraph(
          'Cualquier actividad, suministro o modificación no contemplada inicialmente deberá evaluarse y cotizarse por separado antes de su ejecución.',
        ),
      ]),
      richtextSeccion('comerciales-precios', 'Precios e Impuestos', [
        paragraph(
          'Los precios se expresan en pesos e incluyen IVA, salvo que se indique expresamente lo contrario.',
        ),
        paragraph(
          'Los gastos de envío, viáticos, maniobras, permisos, instalaciones o conceptos adicionales únicamente estarán incluidos cuando aparezcan desglosados en la propuesta.',
        ),
      ]),
      richtextSeccion('comerciales-entrega', 'Entrega de productos', [
        paragraph(
          'Los tiempos de entrega comenzarán a contar a partir de la confirmación del pedido, la recepción del anticipo y la aprobación de las especificaciones aplicables.',
        ),
        paragraph(
          'Las fechas informadas son estimadas y pueden ajustarse por disponibilidad, ubicación de entrega, personalizaciones o situaciones ajenas al control del proveedor.',
        ),
        paragraph(
          'El cliente deberá verificar los productos al momento de recibirlos y reportar cualquier daño, faltante o diferencia dentro de las siguientes ',
          { t: '48 horas', bold: true },
          '.',
        ),
      ]),
      richtextSeccion('comerciales-servicios', 'Programación de Servicios', [
        paragraph(
          'La prestación de los servicios deberá programarse con al menos ',
          { t: '7 días hábiles', bold: true },
          ' de anticipación y estará sujeta a disponibilidad.',
        ),
        paragraph(
          'Antes de la fecha programada, el cliente deberá confirmar el alcance, domicilio, horario, persona de contacto y condiciones de acceso.',
        ),
        paragraph(
          'Si el servicio no puede realizarse por causas atribuibles al cliente, la reprogramación podrá generar cargos adicionales por traslados, viáticos, materiales o tiempo reservado.',
        ),
      ]),
    ],
  },
  {
    claveSeed: CLAVE_SEED_ADMINISTRATIVOS,
    nombre: 'Requerimientos Administrativos',
    secciones: [
      richtextSeccion('administrativos-confirmacion', 'Confirmación del pedido', [
        paragraph(
          'La contratación se considerará confirmada mediante la aceptación por escrito de la cotización, la emisión de una orden de compra o el pago del anticipo correspondiente.',
        ),
        paragraph(
          'Cualquier orden de compra deberá coincidir con el alcance, precios y condiciones establecidos en esta propuesta.',
        ),
      ]),
      richtextSeccion(
        'administrativos-anticipo',
        'Anticipo y condiciones de pago',
        [
          paragraph(
            'Cuando corresponda, se requerirá un anticipo de ',
            { t: '50%', bold: true },
            ' para iniciar la adquisición de materiales, reservar disponibilidad o programar los servicios. El importe restante deberá cubrirse conforme al calendario indicado en la cotización.',
          ),
          paragraph(
            'Los pagos deberán realizarse mediante transferencia bancaria a la cuenta señalada en la factura o documento de cobro correspondiente.',
          ),
        ],
      ),
      richtextSeccion('administrativos-credito', 'Crédito', [
        paragraph(
          'Las condiciones de crédito están sujetas a evaluación y autorización previa. En caso de aprobarse, el plazo será de ',
          { t: '15 días naturales', bold: true },
          ' contados a partir de la fecha de emisión de la factura.',
        ),
        paragraph(
          'El incumplimiento de los plazos acordados podrá ocasionar la suspensión temporal de entregas, servicios o nuevas programaciones hasta regularizar el saldo pendiente.',
        ),
      ]),
      richtextSeccion('administrativos-facturacion', 'Facturación', [
        paragraph(
          'Para emitir la factura, el cliente deberá proporcionar su constancia de situación fiscal vigente, uso de CFDI, régimen fiscal, código postal y correo de recepción.',
        ),
        paragraph(
          'Las solicitudes de corrección deberán presentarse dentro del mismo mes de emisión y antes del cierre administrativo correspondiente.',
        ),
      ]),
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
    // Copia profunda: evita mutar el módulo si Mongoose toca el array insertado.
    secciones: JSON.parse(JSON.stringify(seed.secciones)) as SeccionPlantillaV1[],
    activo: true,
  };
}
