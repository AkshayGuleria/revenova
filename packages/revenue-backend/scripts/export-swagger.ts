import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';

process.env.SWAGGER_EXPORT = 'true';

async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );

  const config = new DocumentBuilder()
    .setTitle('Revenova Backend API')
    .setDescription('B2B Enterprise billing system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outPath = resolve(__dirname, '../../../docs/reference/openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`Swagger spec written to ${outPath} (${Object.keys(document.paths).length} paths)`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Swagger export failed:', err);
  process.exit(1);
});
