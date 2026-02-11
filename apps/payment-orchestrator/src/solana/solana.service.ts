import { Injectable, Logger } from '@nestjs/common';
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    clusterApiUrl,
} from '@solana/web3.js';
import { ValidationResult } from '../validation-engine/validation-engine.service';
import { TransactionStatus } from '../generated-client';
import Decimal from 'decimal.js';

@Injectable()
export class SolanaService {
    private readonly logger = new Logger(SolanaService.name);
    private connection: Connection;

    constructor() {
        // Default to Devnet
        const rpcEndpoint = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
        this.connection = new Connection(rpcEndpoint, 'confirmed');
    }

    async getVersion() {
        const version = await this.connection.getVersion();
        return version['solana-core'];
    }

    async getPayerBalance(publicKey: string): Promise<number> {
        const pubKey = new PublicKey(publicKey);
        return await this.connection.getBalance(pubKey);
    }

    async requestAirdrop(publicKey: string, amountSol: number = 1): Promise<string> {
        const pubKey = new PublicKey(publicKey);
        const signature = await this.connection.requestAirdrop(pubKey, amountSol * 1e9);
        await this.connection.confirmTransaction(signature);
        this.logger.log(`Airdrop of ${amountSol} SOL successful to ${publicKey}`);
        return signature;
    }

    async sendSol(fromKeypair: Keypair, toAddress: string, amountSol: number): Promise<string> {
        const toPubKey = new PublicKey(toAddress);
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromKeypair.publicKey,
                toPubkey: toPubKey,
                lamports: amountSol * 1e9,
            })
        );

        try {
            const signature = await sendAndConfirmTransaction(this.connection, transaction, [fromKeypair]);
            this.logger.log(`Transaction confirmed: ${signature}`);
            return signature;
        } catch (error) {
            this.logger.error(`Error sending transaction: ${error.message}`);
            throw error;
        }
    }

    async validateTransaction(
        signature: string,
        expectedAmount: number,
        merchantAddress: string
    ): Promise<ValidationResult> {
        // ... (existing implementation)
        // Note: Reusing existing logic but method needs to be robust locally
        this.logger.log(`Validating Solana transaction ${signature}`);
        try {
            const tx = await this.connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });

            if (!tx) {
                this.logger.error(`Transaction ${signature} not found`);
                return { status: TransactionStatus.REFUSED };
            }

            if (tx.meta?.err) {
                this.logger.warn(`Transaction ${signature} failed on-chain`);
                return { status: TransactionStatus.REFUSED };
            }

            // Verify amount transfer to merchant
            const accountIndex = tx.transaction.message.staticAccountKeys.findIndex(k => k.toBase58() === merchantAddress);

            if (accountIndex === -1) {
                this.logger.warn(`Merchant address ${merchantAddress} not found in static keys`);
                return { status: TransactionStatus.REFUSED };
            }

            const preBalance = tx.meta?.preBalances[accountIndex] || 0;
            const postBalance = tx.meta?.postBalances[accountIndex] || 0;

            const receivedLamports = postBalance - preBalance;
            const receivedSol = new Decimal(receivedLamports).dividedBy(1e9);

            const expected = new Decimal(expectedAmount);
            // 0.5% tolerance
            const tolerance = expected.times(0.005);
            const minAccepted = expected.minus(tolerance);

            this.logger.log(`Solana Tx Analysis: Pre=${preBalance}, Post=${postBalance}, Received=${receivedSol} SOL, Expected=${expected} SOL`);

            if (receivedSol.lt(minAccepted)) {
                const missing = expected.minus(receivedSol);
                this.logger.warn(`Transaction ${signature} PARTIAL PAYMENT: Recu ${receivedSol}, Attendu ${expected}. Manque ${missing}`);
                return {
                    status: TransactionStatus.PARTIAL_PAYMENT,
                    missingAmount: missing.toNumber(),
                    receivedAmount: receivedSol.toNumber()
                };
            }

            return { status: TransactionStatus.VALIDATED };

        } catch (error) {
            this.logger.error(`Error validating Solana transaction: ${error.message}`);
            return { status: TransactionStatus.PENDING };
        }
    }

    /**
     * Monitors the merchant's wallet for incoming transactions.
     * When a change is detected, checks the latest transaction.
     */
    monitorMerchantAddress(merchantAddress: string, onNewTransaction: (signature: string) => Promise<void>) {
        try {
            const publicKey = new PublicKey(merchantAddress);
            this.logger.log(`Starting monitoring for Solana address: ${merchantAddress}`);

            this.connection.onAccountChange(
                publicKey,
                async (updatedAccountInfo, context) => {
                    this.logger.log(`Account change detected for ${merchantAddress}. Slot: ${context.slot}`);

                    // Fetch the latest transaction for this address
                    try {
                        const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit: 1 });
                        if (signatures.length > 0) {
                            const latestSig = signatures[0].signature;
                            this.logger.log(`Latest signature found: ${latestSig}`);
                            // Callback to orchestrator to handle the potential payment
                            await onNewTransaction(latestSig);
                        }
                    } catch (err) {
                        this.logger.error(`Error fetching signatures after account change: ${err.message}`);
                    }
                },
                'confirmed'
            );
        } catch (error) {
            this.logger.error(`Failed to start monitoring: ${error.message}`);
        }
    }
}
