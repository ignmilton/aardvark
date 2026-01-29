import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import compression from 'compression';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Request body size limits
const JSON_LIMIT = '10mb';
const URL_ENCODED_LIMIT = '10mb';
const RAW_LIMIT = '10mb';

/**
 * Bootstrap the NestJS application with all required middleware,
 * interceptors, filters, and documentation.
 */
async function bootstrap() {
  // SECURITY: In production, only log errors and warnings to prevent information disclosure
  const isProd = process.env.NODE_ENV === 'production';
  const loggerLevels: ('error' | 'warn' | 'log' | 'debug' | 'verbose')[] = isProd
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug', 'verbose'];

  const app = await NestFactory.create(AppModule, {
    logger: loggerLevels,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // Body size limits (prevent DoS attacks with large payloads)
  app.use(bodyParser.json({ limit: JSON_LIMIT }));
  app.use(bodyParser.urlencoded({ limit: URL_ENCODED_LIMIT, extended: true }));
  app.use(bodyParser.raw({ limit: RAW_LIMIT, type: 'application/octet-stream' }));

  // Security middleware with CSP configuration
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
              connectSrc: [
                "'self'",
                'https://api.stripe.com',
                'wss://*.aardvark.com',
                configService.get('CORS_ORIGIN', 'https://aardvark.com'),
              ],
              frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              workerSrc: ["'self'", 'blob:'],
            },
          }
        : false, // Disable CSP in development for easier debugging
      crossOriginEmbedderPolicy: false, // Required for Stripe integration
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
    }),
  );
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: isProduction
      ? configService.get('CORS_ORIGIN', 'https://aardvark.com')
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'metrics'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: isProduction,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  // WebSocket adapter for Socket.io
  app.useWebSocketAdapter(new IoAdapter(app));

  // Swagger API documentation (disabled in production)
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Aardvark API')
      .setDescription('Interactive Fiction Platform API Documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('stories', 'Story CRUD endpoints')
      .addTag('segments', 'Story segment endpoints')
      .addTag('choices', 'Story choice endpoints')
      .addTag('progress', 'Reading progress endpoints')
      .addTag('comments', 'Comment endpoints')
      .addTag('ratings', 'Rating and review endpoints')
      .addTag('credits', 'Credit system endpoints')
      .addTag('subscriptions', 'Subscription endpoints')
      .addTag('moderation', 'Moderation endpoints')
      .addTag('admin', 'Admin endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);

  console.log(`
    🚀 Aardvark API is running!
    📍 Port: ${port}
    🌍 Environment: ${configService.get('NODE_ENV', 'development')}
    📚 API Docs: http://localhost:${port}/api/docs
  `);
}

bootstrap();
