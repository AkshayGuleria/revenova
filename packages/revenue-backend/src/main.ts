import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { join } from 'path';
import fastifyStatic from '@fastify/static';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174', // Alternative port when 5173 is busy
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Serve static files from public directory
  await app.register(fastifyStatic, {
    root: join(__dirname, 'public'),
    prefix: '/',
    decorateReply: false, // Don't add reply.sendFile method
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Revenova Backend API')
    .setDescription('B2B Enterprise billing system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
    `,
    customJs: '/swagger-search.js',
    swaggerOptions: {
      // filter: true, // Enable tag filter
      showRequestDuration: true, // Show request duration
      persistAuthorization: true, // Persist authorization data
      displayOperationId: false, // Hide operation IDs
      tryItOutEnabled: true, // Enable "Try it out" by default
      deepLinking: true, // Enable deep linking for operations
      displayRequestDuration: true, // Show request duration in responses
    },
  });

  const port = process.env.PORT || 5177;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Revenue Backend running on http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
