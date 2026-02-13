
import { formatCurrency, formatDateShort } from './pdf-utils';

export const getCotizacionDefinition = (
  detalle: any,
  logoBase64: string
): any => {
  
  // Helpers para obtener datos de forma segura
  const getCliente = (): any => {
    // Si hay clienteId poblado, usarlo
    if (detalle.clienteId && typeof detalle.clienteId === 'object') return detalle.clienteId;
    
    // Si es cotización guest, usar campos embebidos
    if (detalle.nombreEmpresa) {
      return {
        empresa: detalle.nombreEmpresa,
      };
    }
    
    return { empresa: 'Cliente no disponible' };
  };

  const getSede = (): any => {
    if (detalle.sedeId && typeof detalle.sedeId === 'object') return detalle.sedeId;
    return { ciudad: 'Sede no disponible', clave: '' };
  };

  const getUsuarioCliente = (): { nombre?: string; email?: string; telefono?: string } => {
    // Si viene el objeto poblado (cotización de cliente registrado)
    if (detalle.usuarioClienteId && typeof detalle.usuarioClienteId === 'object') {
        return detalle.usuarioClienteId;
    }
    
    // Si es cotización guest, usar campos embebidos
    if (detalle.nombreContacto) {
      return {
        nombre: detalle.nombreContacto,
        email: detalle.emailContacto || undefined,
        telefono: detalle.telefonoContacto || undefined
      };
    }
    
    // Fallback básico con el email de contacto de la cotización
    return { email: detalle.emailContacto };
  };

  const iva = detalle.total * 0.16;
  const total = detalle.total + iva;
  const cliente = getCliente();
  const sede = getSede();
  const usuario = getUsuarioCliente();

  // Construir filas de la tabla
  const tableBody = [
    [
      { text: 'Servicio', style: 'tableHeader' },
      { text: 'Descripción', style: 'tableHeader' },
      { text: 'Cantidad', style: 'tableHeader', alignment: 'center' },
      { text: 'Precio Unitario', style: 'tableHeader', alignment: 'right' },
      { text: 'Subtotal', style: 'tableHeader', alignment: 'right' }
    ]
  ];

  detalle.items.forEach((item: any) => {
    const nombreServicio = item.nombreServicioSnapshot || 'Servicio';
    const descripcion = item.descripcionServicioSnapshot || '';
    tableBody.push([
      { text: nombreServicio, style: 'tableCell', alignment: 'left' },
      { text: descripcion, style: 'tableCell', alignment: 'left' },
      { text: item.cantidad.toString(), style: 'tableCell', alignment: 'center' },
      { text: formatCurrency(item.precioUnitarioSnapshot), style: 'tableCell', alignment: 'right' },
      { text: formatCurrency(item.subtotal), style: 'tableCell', alignment: 'right' }
    ] as any);
  });

  return {
    pageSize: 'LETTER',
    pageMargins: [40, 80, 40, 60], // [left, top, right, bottom]
    
    header: {
      columns: [
        {
          image: logoBase64,
          width: 75,
          margin: [40, 20, 0, 0]
        },
        {
          text: 'COTIZACIÓN',
          alignment: 'right',
          style: 'headerTitle',
          margin: [0, 30, 40, 0]
        }
      ]
    },

    footer: (_currentPage: number, _pageCount: number) => {
      return {
        columns: [
          {
            stack: [
              { text: 'Médica Ocupacional Caborca', style: 'footerText' },
              { text: 'Avenida J, No. 80. Heroica Caborca Centro', style: 'footerText' },
              { text: 'Tel: (52) 637935-8499 | mocaborca.com', style: 'footerText' }
            ],
            alignment: 'center'
          }
        ],
        margin: [40, 0, 40, 0]
      };
    },

    content: [
      // Espacio para header
      { text: '', margin: [0, 0] },

      // Información General
      {
        columns: [
          {
            width: '*',
            text: ''
          },
          {
            width: 'auto',
            alignment: 'right',
            text: [
              { text: 'Folio: ', bold: true },
              { text: detalle.folio, bold: true, fontSize: 14 }
            ]
          }
        ],
        margin: [0, 0, 0, 20]
      },

      {
        style: 'sectionParams',
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              { text: 'Estado', style: 'paramLabel' },
              { text: 'Fecha', style: 'paramLabel' },
              { text: 'Vencimiento', style: 'paramLabel' },
              { text: 'Sede', style: 'paramLabel' }
            ],
            [
              { text: detalle.estado.toUpperCase(), style: 'paramValue', color: getColorForEstado(detalle.estado) },
              { text: formatDateShort(detalle.fechaCreacion), style: 'paramValue' },
              { text: formatDateShort(detalle.fechaVencimiento), style: 'paramValue' },
              { text: sede.ciudad || sede.clave || '-', style: 'paramValue' }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20]
      },

      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#E5E7EB' }] },
      { text: ' ', fontSize: 5 },

      // Información del Cliente
      { text: 'INFORMACIÓN DEL CLIENTE', style: 'sectionHeader' },
      {
        columns: [
          // Columna 1: Empresa y RFC
          {
            width: '*',
            text: [
              { text: 'Empresa:\n', style: 'label' },
              { text: (cliente.empresa || '-') + '\n\n', style: 'value' },
              { text: 'RFC:\n', style: 'label' },
              { text: (cliente.rfc || '-') + '\n', style: 'value' }
            ]
          },
          // Columna 2: Nombre de Contacto y Teléfono
          {
            width: '*',
            text: [
              { text: 'Contacto:\n', style: 'label' },
              { text: (usuario.nombre || '-') + '\n\n', style: 'value' },
              { text: 'Teléfono:\n', style: 'label' },
              { text: (usuario.telefono || '-') + '\n', style: 'value' }
            ]
          },
          // Columna 3: Email y Persona(s) a evaluar (tercera posición segunda fila)
          {
            width: '*',
            text: [
              { text: 'Email:\n', style: 'label' },
              { text: (usuario.email || detalle.emailContacto || '-') + '\n\n', style: 'value' },
              { text: 'Persona(s) a evaluar – nombre(s):\n', style: 'label' },
              { text: (detalle.personasAEvaluar || '-') + '\n', style: 'value' }
            ]
          }
        ],
        margin: [0, 10, 0, 20]
      },

      // Tabla de Servicios
      { text: 'SERVICIOS COTIZADOS', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: ['20%', '*', 'auto', 'auto', 'auto'],
          body: tableBody
        },
        layout: 'lightHorizontalLines',
        margin: [0, 10, 0, 20]
      },

      // Totales
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            table: {
              widths: ['*', 'auto'],
              body: [
                [
                  { text: 'Subtotal:', alignment: 'right', style: 'totalLabel' },
                  { text: formatCurrency(detalle.total), alignment: 'right', style: 'totalValue' }
                ],
                [
                  { text: 'IVA (16%):', alignment: 'right', style: 'totalLabel' },
                  { text: formatCurrency(iva), alignment: 'right', style: 'totalValue' }
                ],
                [
                  { text: 'TOTAL:', alignment: 'right', style: 'totalLabelBold' },
                  { text: formatCurrency(total), alignment: 'right', style: 'totalValueBold' }
                ]
              ]
            },
            layout: 'noBorders'
          }
        ]
      }
    ],

    styles: {
      headerTitle: {
        fontSize: 18,
        bold: true,
        color: '#111827'
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        color: '#374151',
        decoration: 'underline',
        margin: [0, 10, 0, 5]
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: '#000000',
        fillColor: '#F3F4F6',
        margin: [5, 5, 5, 5]
      },
      tableCell: {
        fontSize: 10,
        color: '#374151',
        margin: [5, 5, 5, 5]
      },
      paramLabel: {
        fontSize: 9,
        color: '#6B7280',
        bold: true
      },
      paramValue: {
        fontSize: 10,
        color: '#111827'
      },
      label: {
        fontSize: 9,
        color: '#6B7280',
        bold: true
      },
      value: {
        fontSize: 10,
        color: '#111827'
      },
      totalLabel: {
        fontSize: 10,
        bold: true,
        color: '#4B5563'
      },
      totalValue: {
        fontSize: 10,
        color: '#111827'
      },
      totalLabelBold: {
        fontSize: 12,
        bold: true,
        color: '#111827'
      },
      totalValueBold: {
        fontSize: 12,
        bold: true,
        color: '#111827'
      },
      footerText: {
        fontSize: 8,
        color: '#9CA3AF',
        margin: [0, 2]
      }
    }
  };
};

function getColorForEstado(estado: string): string {
  switch (estado) {
    case 'vigente': return '#059669'; // green-600
    case 'aceptada': return '#2563EB'; // blue-600
    case 'rechazada': return '#DC2626'; // red-600
    case 'vencida': return '#4B5563'; // gray-600
    default: return '#000000';
  }
}
