import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generatePdf(cotizacionId: string, folio: string): Promise<string> {
    // TODO: implementar en fase posterior
    this.logger.log(`Stub: Generaría PDF para cotización ${folio}`);
    // Retornar URL stub por ahora
    return `https://example.com/pdf/${cotizacionId}`;
  }
}
