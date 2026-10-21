import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { MEDIA_MAX_BYTES, establishment, mediaFile } from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import type { DbExecutor } from '../../common/services/types';
import type { AuthenticatedUser } from '../../common/types';
import type { PhotoInputDto } from './dto/photo.dto';

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/** Establecimientos que cualquiera ve como destino: su foto tambien es visible. */
const PUBLIC_ESTABLISHMENT_TYPES = ['SALA_EXTRACCION', 'FRACCIONADORA', 'ACOPIO'] as const;

export interface DecodedImage {
  contentType: string;
  buffer: Buffer;
}

export const decodeDataUrl = (value: string): DecodedImage | null => {
  const match = DATA_URL.exec(value);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
};

export const toDataUrl = (contentType: string, buffer: Buffer): string =>
  `data:${contentType};base64,${buffer.toString('base64')}`;

/**
 * Fotos de los maestros (tabla media_file).
 *
 * Se leen como JSON con la imagen en data URL, y no como binario, porque la
 * aplicacion usa token Bearer: una etiqueta <img src> no puede mandarlo. Asi la
 * foto pasa por la misma capa de red y por la misma cache sin conexion que el
 * resto de los datos.
 */
@Injectable()
export class MediaService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
  ) {}

  /** Guarda la foto y devuelve su id. Se llama dentro de la transaccion del alta. */
  async store(
    photo: PhotoInputDto,
    context: { organizationId: string | null; entityType: string; actorId: string },
    executor: DbExecutor = this.db,
  ): Promise<string> {
    const full = decodeDataUrl(photo.dataUrl);
    if (!full || full.buffer.length === 0) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'FOTO_INVALIDA',
        'La foto no se pudo leer. Volve a sacarla o elegi otra.',
      );
    }
    if (full.buffer.length > MEDIA_MAX_BYTES) {
      throw new DomainRuleException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'FOTO_DEMASIADO_GRANDE',
        'La foto pesa mas de 3 MB. Saca otra o elegi una mas liviana.',
        { maxBytes: MEDIA_MAX_BYTES, bytes: full.buffer.length },
      );
    }
    const decodedThumb = photo.thumbnailDataUrl ? decodeDataUrl(photo.thumbnailDataUrl) : null;
    // Se guarda un solo tipo de contenido: una miniatura de otro formato se descarta.
    const thumb = decodedThumb?.contentType === full.contentType ? decodedThumb : null;

    const [row] = await executor
      .insert(mediaFile)
      .values({
        organizationId: context.organizationId,
        entityType: context.entityType,
        contentType: full.contentType,
        data: full.buffer,
        thumbnail: thumb?.buffer ?? null,
        byteSize: full.buffer.length,
        width: photo.width ?? null,
        height: photo.height ?? null,
        createdById: context.actorId,
      })
      .returning({ id: mediaFile.id });
    return row.id;
  }

  async read(id: string, actor: AuthenticatedUser, variant: 'full' | 'thumbnail') {
    const rows = await this.db
      .select({
        id: mediaFile.id,
        organizationId: mediaFile.organizationId,
        contentType: mediaFile.contentType,
        data: variant === 'full' ? mediaFile.data : mediaFile.thumbnail,
        fallback: variant === 'thumbnail' ? mediaFile.data : mediaFile.thumbnail,
        width: mediaFile.width,
        height: mediaFile.height,
        createdAt: mediaFile.createdAt,
      })
      .from(mediaFile)
      .where(eq(mediaFile.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException('Foto no encontrada.');

    if (!this.access.hasGlobalScope(actor) && row.organizationId !== actor.organizationId) {
      // La foto de una sala o un acopio activo es publica, como el resto de sus datos de destino.
      const shared = await this.db
        .select({ id: establishment.id })
        .from(establishment)
        .where(
          and(
            eq(establishment.photoId, id),
            eq(establishment.status, 'ACTIVE'),
            inArray(establishment.type, [...PUBLIC_ESTABLISHMENT_TYPES]),
          ),
        )
        .limit(1);
      if (shared.length === 0) throw new NotFoundException('Foto no encontrada.');
    }

    // Una foto vieja sin miniatura se sirve completa: es mejor que no mostrar nada.
    const buffer = row.data ?? row.fallback;
    if (!buffer) throw new NotFoundException('Foto no encontrada.');
    return {
      id: row.id,
      contentType: row.contentType,
      dataUrl: toDataUrl(row.contentType, buffer),
      width: row.width,
      height: row.height,
      createdAt: row.createdAt,
    };
  }
}
