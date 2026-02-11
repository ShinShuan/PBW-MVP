import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class TpeGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    handleConnection(client: Socket) {
        console.log(`TPE-UI Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`TPE-UI Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('PAYMENT_REQUEST')
    handlePaymentRequest(client: Socket, payload: { amount: number }) {
        console.log(`Received Payment Request: ${payload.amount} cents`);
        // Echo the request to all connected UI clients (or just the one)
        this.server.emit('PAYMENT_REQUEST', payload);
    }

    /**
     * Method to be called by the Payment Orchestrator (Middleware)
     * to confirm payment on the TPE screen.
     */
    confirmPayment(amount: number) {
        console.log(`Confirming Payment of ${amount} on TPE`);
        this.server.emit('PAYMENT_CONFIRMED', { amount });
    }
}
