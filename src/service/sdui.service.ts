import { Injectable } from '@nestjs/common';

@Injectable()
export class SduiService {
  getHello(): any {
    return 'Hey World!!!';
  }
}
