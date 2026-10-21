import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** data:image/jpeg;base64,… (tambien png y webp). */
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Foto que viaja dentro del alta (apiario, sala, transporte).
 *
 * Viaja en el mismo pedido que el alta, y no en una subida aparte, para que la
 * cola sin conexion la mande junta: si el alta se reintenta, la foto tambien,
 * con la misma clave de idempotencia.
 */
export class PhotoInputDto {
  @ApiProperty({
    description: 'Foto comprimida en el telefono como data URL (JPEG, PNG o WebP; hasta 3 MB).',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ…',
  })
  @IsString()
  @MaxLength(4_200_000)
  @Matches(IMAGE_DATA_URL, { message: 'La foto tiene que ser una imagen JPEG, PNG o WebP.' })
  dataUrl!: string;

  @ApiPropertyOptional({ description: 'Miniatura para los listados (data URL, hasta 200 KB).' })
  @IsOptional()
  @IsString()
  @MaxLength(280_000)
  @Matches(IMAGE_DATA_URL, { message: 'La miniatura tiene que ser una imagen JPEG, PNG o WebP.' })
  thumbnailDataUrl?: string;

  @ApiPropertyOptional({ example: 1280 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  width?: number;

  @ApiPropertyOptional({ example: 960 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  height?: number;
}
