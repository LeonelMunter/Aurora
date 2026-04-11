import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthenticatedRequestUser, CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { ImportService } from './import.service';

@ApiTags('portfolio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolio/:portfolioId/import')
export class ImportController {
  private static readonly maxFileSizeBytes = 5 * 1024 * 1024;

  constructor(private readonly importService: ImportService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Importar transacciones desde CSV' })
  @ApiResponse({ status: 201, description: 'Importacion procesada correctamente.' })
  importTransactions(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.validateFile(file);
    return this.importService.processImport(user.userId, portfolioId, file);
  }

  @Get()
  @ApiOperation({ summary: 'Historial de importaciones' })
  @ApiResponse({ status: 200, description: 'Importaciones recuperadas correctamente.' })
  getImports(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
  ) {
    return this.importService.getImports(user.userId, portfolioId);
  }

  @Get(':importId')
  @ApiOperation({ summary: 'Detalle de una importacion' })
  @ApiResponse({ status: 200, description: 'Detalle de importacion recuperado correctamente.' })
  getImportDetail(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
    @Param('importId', new ParseUUIDPipe()) importId: string,
  ) {
    return this.importService.getImportDetail(user.userId, portfolioId, importId);
  }

  private validateFile(file?: Express.Multer.File): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException('Debes adjuntar un archivo CSV en el campo file.');
    }

    const isCsvExtension = file.originalname.toLowerCase().endsWith('.csv');
    const isCsvMimeType = file.mimetype === 'text/csv';

    if (!isCsvExtension && !isCsvMimeType) {
      throw new BadRequestException('El archivo debe ser un CSV valido.');
    }

    if (file.size > ImportController.maxFileSizeBytes) {
      throw new BadRequestException('El archivo no puede superar los 5MB.');
    }
  }
}
