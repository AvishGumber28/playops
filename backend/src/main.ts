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

  app.enableCors({
    origin: config.get<string>('ALLOWED_ORIGIN') || '*',
  });

  const port = config.get<number>('PORT') || 4000;
  await app.listen(port);
  console.log(`PlayOps backend running on port ${port}`);
}
void bootstrap();
