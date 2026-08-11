import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';

/** Crea el directorio (y padres) si no existen. */
export function ensureDir(absDir: string): void {
  if (!existsSync(absDir)) {
    mkdirSync(absDir, { recursive: true });
  }
}

/**
 * Escribe un buffer en disco. Errores de FS → BadRequestException.
 * Story 8.1 / action item: superficie compartida para logos y catálogo.
 */
export function writeBufferFile(
  absPath: string,
  buffer: Buffer,
  writeErrorMessage = 'No se pudo escribir el archivo en disco',
): void {
  try {
    ensureDir(dirname(absPath));
    writeFileSync(absPath, buffer);
  } catch {
    throw new BadRequestException(writeErrorMessage);
  }
}

/** Borrado best-effort (ignora ENOENT / permisos). */
export function unlinkQuiet(absPath: string): void {
  if (!existsSync(absPath)) return;
  try {
    unlinkSync(absPath);
  } catch {
    /* ignore */
  }
}
