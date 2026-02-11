import { Controller, Post, Body, Logger, UseGuards, OnModuleInit } from '@nestjs/common';
import { PriceEngineService } from './price-engine/price-engine.service';
import { ValidationEngineService, ValidationResult } from './validation-engine/validation-engine.service';
import { SolanaService } from './solana/solana.service';
import { TransactionStatus } from './generated-client';
import { TpeService } from './tpe.service';
import { PrismaService } from './prisma/prisma.service';

@Controller('simulation')
export class SimulationController implements OnModuleInit {
    private readonly logger = new Logger(SimulationController.name);

    constructor(
        private priceEngine: PriceEngineService,
        private validationEngine: ValidationEngineService,
        private solanaService: SolanaService,
        private readonly tpeService: TpeService,
        private prisma: PrismaService
    ) { }

    onModuleInit() {
        // Start monitoring the merchant address for incoming SOL payments
        const merchantSolAddress = process.env.MERCHANT_SOLANA_WALLET_ADDRESS || 'EbD4gX8X8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x';
        this.solanaService.monitorMerchantAddress(merchantSolAddress, this.handleNewSolanaTransaction.bind(this));
    }

    /**
     * Callback triggered when the Solana Service detects a new transaction on the merchant wallet.
     */
    async handleNewSolanaTransaction(signature: string) {
        this.logger.log(`New Solana transaction detected: ${signature}. Check for pending payments...`);

        // Find the most recent PENDING transaction
        // In a real app, we would match precise amounts or memo fields.
        // For MVP, we take the last pending transaction.
        const pendingTx = await (this.prisma as any).transaction.findFirst({
            where: { status: TransactionStatus.PENDING, crypto_currency: 'SOL' },
            orderBy: { created_at: 'desc' },
        });

        if (!pendingTx) {
            this.logger.log('No pending SOL transaction found to match.');
            return;
        }

        this.logger.log(`Found pending transaction ${pendingTx.id} expecting ${pendingTx.crypto_amount} SOL. Validating...`);

        const merchantSolAddress = process.env.MERCHANT_SOLANA_WALLET_ADDRESS || 'EbD4gX8X8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x';
        const result = await this.solanaService.validateTransaction(signature, Number(pendingTx.crypto_amount), merchantSolAddress);

        if (result.status === TransactionStatus.VALIDATED) {
            this.logger.log(`PAYMENT CONFIRMED for ${pendingTx.id}`);

            // Update DB with Hash and Status
            await (this.prisma as any).transaction.update({
                where: { id: pendingTx.id },
                data: {
                    status: TransactionStatus.VALIDATED,
                    tx_hash: signature
                }
            });

            // Notify TPE
            this.tpeService.notifyPaymentConfirmed(Number(pendingTx.fiat_amount) * 100);

        } else if (result.status === TransactionStatus.PARTIAL_PAYMENT) {
            this.logger.warn(`PARTIAL PAYMENT for ${pendingTx.id}`);
            // Could notify TPE to show "Insufficient funds"
            // For now, we just log it.
        }
    }

    @Post('payment')
    async simulatePayment(@Body() body: { fiatAmount: number, currency: string, network?: 'BSC' | 'SOLANA' }) {
        const { fiatAmount, currency, network = 'BSC' } = body;

        this.logger.log(`Step 1: Caisse - Paiement de ${fiatAmount} ${currency} demandé.`);

        // Step 2: Middleware - Appelle l'API de prix
        this.logger.log(`Step 2: Middleware - Fetching best quote...`);
        const quote = await this.priceEngine.getBestQuote(fiatAmount, network === 'BSC' ? 'BNB' : 'SOL');
        this.logger.log(`Middleware: Veuillez envoyer ${quote.cryptoAmount} ${network === 'BSC' ? 'BNB' : 'SOL'}.`);

        // Create Pending Transaction in DB to track it
        await (this.prisma as any).transaction.create({
            data: {
                fiat_amount: fiatAmount,
                fiat_currency: currency,
                crypto_amount: quote.cryptoAmount.toNumber(),
                crypto_currency: network === 'BSC' ? 'BNB' : 'SOL',
                status: TransactionStatus.PENDING,
            }
        });

        // Notify TPE UI to show the amount and QR
        this.tpeService.notifyPaymentRequest(fiatAmount * 100);

        return {
            status: 'AWAITING_PAYMENT',
            instruction: `Veuillez envoyer ${quote.cryptoAmount} au wallet marchand.`,
            quote,
            merchantAddress: network === 'BSC' ? (process.env.MERCHANT_WALLET_ADDRESS || '0x000') : (process.env.MERCHANT_SOLANA_WALLET_ADDRESS || 'EbD4gX8X8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x8x')
        };
    }
}
