import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { PriceEngineService } from './price-engine/price-engine.service';
import { ValidationEngineService } from './validation-engine/validation-engine.service';
import { SolanaService } from './solana/solana.service';
import { TransactionStatus } from './generated-client';

@Controller('simulation')
export class SimulationController {
    private readonly logger = new Logger(SimulationController.name);

    constructor(
        private priceEngine: PriceEngineService,
        private validationEngine: ValidationEngineService,
        private solanaService: SolanaService,
    ) { }

    @Post('payment')
    async simulatePayment(@Body() body: { fiatAmount: number, currency: string, network?: 'BSC' | 'SOLANA', txHash?: string }) {
        const { fiatAmount, currency, network = 'BSC', txHash } = body;

        this.logger.log(`Step 1: Caisse - Paiement de ${fiatAmount} ${currency} demandé.`);

        // Step 2: Middleware - Appelle l'API de prix
        this.logger.log(`Step 2: Middleware - Fetching best quote...`);
        const quote = await this.priceEngine.getBestQuote(fiatAmount, network === 'BSC' ? 'BNB' : 'SOL');
        this.logger.log(`Middleware: Veuillez envoyer ${quote.cryptoAmount} ${network === 'BSC' ? 'BNB' : 'SOL'}.`);

        // Step 3: Client - Scanne le QR Code et paie (Simulé)
        this.logger.log(`Step 3: Client - Scan QR Code et simulation du paiement.`);

        if (!txHash) {
            this.logger.warn('Workflow Simulation: En attente du Hash de transaction...');
            return {
                status: 'AWAITING_PAYMENT',
                instruction: `Veuillez envoyer ${quote.cryptoAmount} au wallet marchand.`,
                quote
            };
        }

        // Step 4: Middleware - Vérification sur la blockchain
        this.logger.log(`Step 4: Middleware - Vérification sur ${network} via ${network === 'BSC' ? 'Moralis' : 'Solana Devnet'}...`);

        let status: TransactionStatus;
        if (network === 'BSC') {
            status = await this.validationEngine.validateTransaction(txHash, quote.cryptoAmount.toNumber(), process.env.MERCHANT_WALLET_ADDRESS || '0x000');
        } else {
            const isValid = await this.solanaService.validateTransaction(txHash);
            status = isValid ? TransactionStatus.VALIDATED : TransactionStatus.REFUSED;
        }

        // Step 5: TPE - Reçoit le signal
        if (status === TransactionStatus.VALIDATED) {
            this.logger.log(`Step 5: TPE - Signal VALIDATED reçu. Impression du ticket.`);
            return {
                status: 'VALIDATED',
                message: 'Paiement confirmé. Ticket en cours d\'impression.',
                txHash
            };
        } else {
            this.logger.error(`Paiement échoué ou non trouvé pour le Hash: ${txHash}`);
            return {
                status: 'FAILED',
                message: 'La transaction n\'a pas pu être validée.'
            };
        }
    }
}
