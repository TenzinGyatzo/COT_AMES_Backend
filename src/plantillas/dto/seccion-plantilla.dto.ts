import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export class CuerpoRichtextDto {
  @ApiProperty({ description: 'Texto plano de la sección richtext' })
  @IsString()
  text: string;

  @ApiPropertyOptional({
    description: 'Documento TipTap/ProseMirror JSON (Story 5.3)',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  doc?: Record<string, unknown>;
}

@ValidatorConstraint({ name: 'isStringMatrix', async: false })
export class IsStringMatrixConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    return value.every(
      (row) =>
        Array.isArray(row) && row.every((cell) => typeof cell === 'string'),
    );
  }

  defaultMessage(): string {
    return 'filas debe ser string[][] (cada fila un arreglo de strings)';
  }
}

/**
 * Shape JSON v1 (Story 5.1 / AD-6). TipTap `cuerpo.doc` opcional (5.3).
 */
export class SeccionPlantillaDto {
  @ApiProperty({ example: 'seed-comerciales-1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  id: string;

  @ApiProperty({ enum: ['richtext', 'tabla'] })
  @IsIn(['richtext', 'tabla'], {
    message: "tipo debe ser 'richtext' o 'tabla'",
  })
  tipo: 'richtext' | 'tabla';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @ApiPropertyOptional({ type: CuerpoRichtextDto })
  @ValidateIf((o: SeccionPlantillaDto) => o.tipo === 'richtext')
  @IsDefined({ message: 'Sección richtext requiere cuerpo' })
  @ValidateNested()
  @Type(() => CuerpoRichtextDto)
  cuerpo?: CuerpoRichtextDto;

  @ApiPropertyOptional({ type: [String], example: ['Documento', 'Requerido'] })
  @ValidateIf((o: SeccionPlantillaDto) => o.tipo === 'tabla')
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  encabezados?: string[];

  @ApiPropertyOptional({
    type: 'array',
    example: [['OC', 'Sí']],
  })
  @ValidateIf((o: SeccionPlantillaDto) => o.tipo === 'tabla')
  @IsArray()
  @Validate(IsStringMatrixConstraint)
  filas?: string[][];
}
