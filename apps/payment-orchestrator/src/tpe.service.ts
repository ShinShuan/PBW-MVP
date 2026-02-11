import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';

@Injectable()
export class TpeService implements OnModuleInit {
    private socket: Socket;
    private readonly logger = new Logger(TpeService.name);

    onModuleInit() {
        this.socket = io('http://localhost:8081');

        this.socket.on('connect', () => {
            this.logger.log('Connected to TPE Emulator Gateway');
        });

        this.socket.on('disconnect', () => {
            this.logger.warn('Disconnected from TPE Emulator Gateway');
        });
    }

    notifyPaymentRequest(amount: number) {
        this.logger.log(`Notifying TPE of payment request: ${amount}`);
        this.socket.emit('PAYMENT_REQUEST', { amount });
    }

    notifyPaymentConfirmed(amount: number) {
        this.logger.log(`Notifying TPE of payment confirmation: ${amount}`);
        this.socket.emit('PAYMENT_CONFIRMED', { amount });
    }
}
