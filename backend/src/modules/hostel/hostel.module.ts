import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HostelController } from './hostel.controller';
import { HostelService } from './hostel.service';

@Module({
  // AuthModule is imported (not just referenced) because JwtAuthGuard
  // needs JwtService injected into it via Nest's DI - that only resolves
  // correctly if this module actually imports the module that exports it.
  imports: [AuthModule],
  controllers: [HostelController],
  providers: [HostelService],
})
export class HostelModule {}
