import { Controller, Get, Header, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/types';

@ApiTags('Fotos')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  // Una foto no cambia: otra foto es otro id. El navegador puede guardarla.
  @Get(':id')
  @Header('Cache-Control', 'private, max-age=604800, immutable')
  @ApiOperation({ summary: 'Foto completa (data URL).' })
  full(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.media.read(id, actor, 'full');
  }

  @Get(':id/thumbnail')
  @Header('Cache-Control', 'private, max-age=604800, immutable')
  @ApiOperation({ summary: 'Miniatura para listados (data URL).' })
  thumbnail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.media.read(id, actor, 'thumbnail');
  }
}
