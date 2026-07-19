import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Counter, CounterDocument } from './schemas/counter.schema';
import {
  Cotizacion,
  CotizacionDocument,
} from '../cotizaciones/schemas/cotizacion.schema';

@Injectable()
export class CountersService {
  private readonly logger = new Logger(CountersService.name);

  constructor(
    @InjectModel(Counter.name)
    private counterModel: Model<CounterDocument>,
    @InjectModel(Cotizacion.name)
    private cotizacionModel: Model<CotizacionDocument>,
  ) {}

  /**
   * Extrae el máximo NNNN de folios `COT-{year}-*` del tenant (brownfield).
   * Exportado para tests unitarios del parser.
   */
  static maxSeqFromFolioStrings(folios: string[], year: number): number {
    const re = new RegExp(`^COT-${year}-(\\d+)$`);
    let max = 0;
    for (const folio of folios) {
      const m = re.exec(folio);
      if (!m) continue;
      const n = Number.parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max;
  }

  private async maxSeqFromExistingCotizaciones(
    tenantId: Types.ObjectId,
    year: number,
  ): Promise<number> {
    const rows = await this.cotizacionModel
      .find({
        tenantId,
        folio: { $regex: `^COT-${year}-` },
      })
      .select({ folio: 1 })
      .lean()
      .exec();
    return CountersService.maxSeqFromFolioStrings(
      rows.map((r) => String((r as { folio?: string }).folio ?? '')),
      year,
    );
  }

  private static isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 11000
    );
  }

  /** Asegura doc counter; al crearlo alinea seq al max folio existente. */
  private async ensureCounter(
    tenantId: Types.ObjectId,
    year: number,
  ): Promise<void> {
    const existing = await this.counterModel
      .findOne({ tenantId, year })
      .select({ _id: 1 })
      .lean()
      .exec();
    if (existing) return;

    const maxSeq = await this.maxSeqFromExistingCotizaciones(tenantId, year);
    try {
      await this.counterModel
        .updateOne(
          { tenantId, year },
          { $setOnInsert: { tenantId, year, seq: maxSeq } },
          { upsert: true },
        )
        .exec();
    } catch (err) {
      // Carrera: otro request ya creó el doc (índice único tenantId+year).
      if (!CountersService.isDuplicateKeyError(err)) throw err;
    }
    // Si el peer insertó un seq menor (scan stale), subir al max brownfield.
    await this.counterModel
      .updateOne({ tenantId, year }, { $max: { seq: maxSeq } })
      .exec();
  }

  async nextSeq(tenantId: Types.ObjectId, year: number): Promise<number> {
    await this.ensureCounter(tenantId, year);
    const updated = await this.counterModel
      .findOneAndUpdate(
        { tenantId, year },
        { $inc: { seq: 1 } },
        { new: true },
      )
      .exec();
    if (!updated || typeof updated.seq !== 'number') {
      this.logger.error(
        `Counter $inc falló tenant=${tenantId} year=${year}`,
      );
      throw new InternalServerErrorException(
        'No se pudo asignar el siguiente folio',
      );
    }
    return updated.seq;
  }

  async nextFolio(tenantId: Types.ObjectId): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.nextSeq(tenantId, year);
    return `COT-${year}-${String(seq).padStart(4, '0')}`;
  }
}
