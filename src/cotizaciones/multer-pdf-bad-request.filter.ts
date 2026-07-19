import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

/** Tope PDF multipart (Story 6.8) — 5 MiB. */
export const PDF_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Errores Multer del adjunto PDF (Story 6.8) → 400. */
@Catch(MulterError)
export class MulterPdfBadRequestFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const message =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'El PDF no puede superar 5MB'
        : exception.message || 'Archivo PDF inválido';
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: 'Bad Request',
    });
  }
}
