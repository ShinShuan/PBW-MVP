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

    async validateTransaction(signature: string): Promise<boolean> {
        const tx = await this.connection.getTransaction(signature, {
            commitment: 'confirmed',
        });
        return !!tx;
    }
}
