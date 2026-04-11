import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthenticatedRequestUser, CurrentUser } from './auth/decorators/current-user.decorator';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller()
export class AppController {
  @Get()
  healthCheck(): { status: string; message: string } {
    return {
      status: 'ok',
      message: 'API corriendo',
    };
  }

  @Get('protected')
  @UseGuards(JwtAuthGuard)
  protectedRoute(
    @CurrentUser() user: AuthenticatedRequestUser,
  ): { message: string; user: AuthenticatedRequestUser } {
    return {
      message: 'Acceso autorizado',
      user,
    };
  }
}
