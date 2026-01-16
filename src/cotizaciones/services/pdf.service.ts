import { Injectable, Logger } from '@nestjs/common';
import PdfPrinter from 'pdfmake/js/Printer';
import * as fs from 'fs';
import * as path from 'path';
import { getCotizacionDefinition } from './cotizacion-pdf-template';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private printer: any;

  constructor() {
    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
        bold: path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
        italics: path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
        bolditalics: path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
      }
    };
    this.printer = new PdfPrinter(fonts);
  }

  async generatePdfBuffer(detalle: any): Promise<Buffer> {
    try {
      const logoPath = path.join(process.cwd(), 'src/assets/logos/exin-cv-salud-laboral-logo.png');
      const logoBase64 = this.getBase64Image(logoPath);
      
      const docDefinition = getCotizacionDefinition(detalle, logoBase64);
      const pdfDoc = await this.printer.createPdfKitDocument(docDefinition);
      
      return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        pdfDoc.on('data', (chunk) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', (err) => reject(err));
        pdfDoc.end();
      });
    } catch (error) {
      this.logger.error(`Error al generar PDF: ${error.message}`);
      throw error;
    }
  }

  private getBase64Image(filePath: string): string {
    const bitmap = fs.readFileSync(filePath);
    const extension = path.extname(filePath).replace('.', '');
    return `data:image/${extension};base64,${bitmap.toString('base64')}`;
  }

  // Mantener firma original por si se usa en otros lados, pero ahora genera el buffer internamente si es necesario
  async generatePdf(cotizacionId: string, folio: string): Promise<string> {
    this.logger.log(`Generando PDF para cotización ${folio}`);
    // Este método originalmente devolvía una URL. 
    // En esta implementación, el PDF se genera al vuelo para enviarlo por email.
    // Si se requiere guardar en disco o S3, se implementaría aquí.
    return `internal-pdf://${cotizacionId}`;
  }
}
