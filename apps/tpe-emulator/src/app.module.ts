import { Module } from '@nestjs/common';
import { TpeGateway } from './tpe.gateway';

@Module({
    imports: [],
    controllers: [],
    providers: [TpeGateway],
})
export class AppModule { }
