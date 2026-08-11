import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

/** Mapea errores de Multer (p.ej. LIMIT_FILE_SIZE) a 400. Copy neutro (logos + catálogo). */
@Catch(MulterError)
export class MulterBadRequestFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const message =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo no puede superar 1MB'
        : exception.message || 'Archivo de imagen inválido';
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: 'Bad Request',
    });
  }
}
