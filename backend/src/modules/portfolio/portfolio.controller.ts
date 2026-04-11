import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthenticatedRequestUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionFilterDto } from './dto/transaction-filter.dto';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo portfolio' })
  @ApiResponse({ status: 201, description: 'Portfolio creado correctamente.' })
  createPortfolio(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.createPortfolio(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar portfolios del usuario' })
  @ApiResponse({ status: 200, description: 'Portfolios recuperados correctamente.' })
  getUserPortfolios(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.portfolioService.getUserPortfolios(user.userId);
  }

  @Get('default')
  @ApiOperation({ summary: 'Obtener portfolio default' })
  @ApiResponse({ status: 200, description: 'Portfolio por defecto recuperado correctamente.' })
  async getDefaultPortfolio(@CurrentUser() user: AuthenticatedRequestUser) {
    const portfolio = await this.portfolioService.getDefaultPortfolio(user.userId);
    const summary = await this.portfolioService.getPortfolioSummary(user.userId, portfolio.id);

    return {
      ...portfolio,
      summary,
    };
  }

  @Get(':portfolioId/positions')
  @ApiOperation({ summary: 'Posiciones actuales del portfolio' })
  @ApiResponse({ status: 200, description: 'Posiciones recuperadas correctamente.' })
  getPositions(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
  ) {
    return this.portfolioService.getPositions(user.userId, portfolioId);
  }

  @Get(':portfolioId/summary')
  @ApiOperation({ summary: 'Resumen general del portfolio' })
  @ApiResponse({ status: 200, description: 'Resumen recuperado correctamente.' })
  getPortfolioSummary(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
  ) {
    return this.portfolioService.getPortfolioSummary(user.userId, portfolioId);
  }

  @Post(':portfolioId/transactions')
  @ApiOperation({ summary: 'Registrar nueva transaccion' })
  @ApiResponse({ status: 201, description: 'Transaccion creada correctamente.' })
  createTransaction(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.portfolioService.createTransaction(user.userId, portfolioId, dto);
  }

  @Get(':portfolioId/transactions')
  @ApiOperation({ summary: 'Listar transacciones con filtros y paginacion' })
  @ApiResponse({ status: 200, description: 'Transacciones recuperadas correctamente.' })
  getTransactions(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
    @Query() filters: TransactionFilterDto,
  ) {
    return this.portfolioService.getTransactions(user.userId, portfolioId, filters);
  }

  @Delete(':portfolioId/transactions/:transactionId')
  @ApiOperation({ summary: 'Eliminar una transaccion' })
  @ApiResponse({ status: 200, description: 'Transaccion eliminada correctamente.' })
  async deleteTransaction(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ): Promise<{ message: string }> {
    await this.portfolioService.deleteTransaction(user.userId, transactionId, portfolioId);

    return {
      message: 'Transacción eliminada correctamente',
    };
  }
}
