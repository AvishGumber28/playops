import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown fields instead of silently accepting them
      forbidNonWhitelisted: true, // rejects requests with unexpected fields
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Phase 12: this used to fall back to '*' (every origin) if
  // ALLOWED_ORIGIN was ever unset - fine in local dev where it's always
  // set, but a silent wildcard is exactly the kind of misconfiguration
  // that should fail loudly at boot instead of quietly running wide open
  // in whatever environment forgot to set it.
  const allowedOrigin = config.get<string>('ALLOWED_ORIGIN');
  if (!allowedOrigin) {
    throw new Error(
      'ALLOWED_ORIGIN must be set - refusing to start with CORS open to every origin.',
    );
  }
  app.enableCors({ origin: allowedOrigin });

  const port = config.get<number>('PORT') || 4000;
  await app.listen(port);
  console.log(`PlayOps backend running on port ${port}`);
}
void bootstrap();
