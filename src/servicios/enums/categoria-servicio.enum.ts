/** Categorías fijas de servicio (FR-16 / Story 4.1). No editables en v1. */
export enum CategoriaServicio {
  MED = 'MED',
  SH = 'SH',
  CAP = 'CAP',
  PC = 'PC',
  EAL = 'EAL',
  RME = 'RME',
  VDP = 'VDP',
  OTR = 'OTR',
}

export const CATEGORIA_SERVICIO_VALUES = Object.values(CategoriaServicio);

/** Nombres completos para UI / Swagger. */
export const CATEGORIA_SERVICIO_LABELS: Record<CategoriaServicio, string> = {
  [CategoriaServicio.MED]: 'Médicos',
  [CategoriaServicio.SH]: 'Seguridad e Higiene',
  [CategoriaServicio.CAP]: 'Capacitación',
  [CategoriaServicio.PC]: 'Protección Civil',
  [CategoriaServicio.EAL]: 'Estudios de Ambiente Laboral',
  [CategoriaServicio.RME]: 'Recarga y Mantenimiento de Extintores',
  [CategoriaServicio.VDP]: 'Ventas de Productos',
  [CategoriaServicio.OTR]: 'Otros',
};
