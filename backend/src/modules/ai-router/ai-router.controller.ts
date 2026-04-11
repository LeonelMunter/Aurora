import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CurrentUser, AuthenticatedRequestUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiRouterService } from './ai-router.service';
import { AiLimit } from './entities/ai-limit.entity';
import { AiModel } from './entities/ai-model.entity';
import { TokenCounterService } from './token-counter.service';

interface ChatBody {
  prompt: string;
  sessionId?: string;
}

interface UpdateLimitsBody {
  monthlyLimitUsd?: number;
  alertAtPct?: number;
  blockOnLimit?: boolean;
}

@ApiTags('ai')
@Controller('ai')
export class AiRouterController {
  constructor(
    private readonly aiRouterService: AiRouterService,
    private readonly tokenCounter: TokenCounterService,
    @InjectRepository(AiModel)
    private readonly aiModelRepository: Repository<AiModel>,
    @InjectRepository(AiLimit)
    private readonly aiLimitRepository: Repository<AiLimit>,
  ) {}

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar prompt al AI Router en modo chat' })
  @ApiResponse({ status: 200, description: 'Respuesta generada correctamente.' })
  chat(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() body: ChatBody,
  ) {
    return this.aiRouterService.chat(body.prompt, user.userId, body.sessionId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener stats del Token Counter' })
  @ApiResponse({ status: 200, description: 'Stats recuperadas correctamente.' })
  getStats(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.tokenCounter.getTokenStats(user.userId, sessionId);
  }

  @Get('models')
  @ApiOperation({ summary: 'Listar modelos activos disponibles' })
  @ApiResponse({ status: 200, description: 'Modelos recuperados correctamente.' })
  async getModels() {
    const models = await this.aiModelRepository.find({
      where: { isActive: true },
      order: { provider: 'ASC', versionLabel: 'ASC' },
    });

    return models.map((model) => ({
      provider: model.provider,
      modelString: model.modelString,
      versionLabel: model.versionLabel,
      freeTierLimit: model.freeTierLimit,
      freeTierTokensDay: model.freeTierTokensDay,
      isPrimary: model.isPrimary,
    }));
  }

  @Put('limits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear o actualizar los limites de IA del usuario' })
  @ApiResponse({ status: 200, description: 'Limites actualizados correctamente.' })
  async updateLimits(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() body: UpdateLimitsBody,
  ): Promise<AiLimit> {
    const existingLimit = await this.aiLimitRepository.findOne({
      where: { userId: user.userId },
    });

    const limit = this.aiLimitRepository.create({
      id: existingLimit?.id,
      userId: user.userId,
      monthlyLimitUsd: body.monthlyLimitUsd ?? existingLimit?.monthlyLimitUsd ?? 50,
      alertAtPct: body.alertAtPct ?? existingLimit?.alertAtPct ?? 80,
      blockOnLimit: body.blockOnLimit ?? existingLimit?.blockOnLimit ?? false,
    });

    return this.aiLimitRepository.save(limit);
  }
}
