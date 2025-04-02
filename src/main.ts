import { NestFactory } from '@nestjs/core';
import { AppModule } from './module/app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import * as dotenv from 'dotenv';
import {requestIdMiddleware} from '@acko-sdui/log-formatter';

dotenv.config();
if (process.env.NEW_RELIC_LICENSE_KEY) require('newrelic');

async function bootstrap() {
  // dotenv.config(); // Load .env file
  const corsOptions: CorsOptions = {
    origin: ['http://localhost:3001','https://www.ackodev.com:3001', 'https://www.ackodev.com', 'https://auto-buy-sdui-frontend.internal.ackodev.com:3000', 'https://auto-buy-sdui-frontend.internal.ackodev.com', 'https://auto-buy-sdui-frontend.internal.live.acko.com', 'https://www.acko.com', 'https://auto-buy-sdui-frontend.acko.com', '*'], // Replace with your frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    };
  const app = await NestFactory.create(AppModule);
  requestIdMiddleware(app)
  app.enableCors(corsOptions);
  await app.listen(3000);
}
bootstrap();
