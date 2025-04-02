import { Module } from '@nestjs/common';
import { AppController } from '../controller/app.controller';
import { AppService } from '../service/app.service';
import { SduiController } from 'src/controller/sdui.controller';
import { SduiService } from 'src/service/sdui.service';
import { ContextDecoratorModule } from '@acko-sdui/context-decorator';

@Module({
  imports: [ContextDecoratorModule],
  controllers: [AppController, SduiController],
  providers: [AppService, SduiService],
})
export class AppModule {}
