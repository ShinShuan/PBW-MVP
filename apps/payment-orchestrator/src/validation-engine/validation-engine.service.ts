import { Injectable, Logger } from '@nestjs/common';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '../generated-client';

export interface ValidationResult {
    status: TransactionStatus;
    missingAmount?: number;
    receivedAmount?: number;
}

@Injectable()
export class ValidationEngineService {
    private readonly logger = new Logger(ValidationEngineService.name);

    constructor(private prisma: PrismaService) { }

    async validateTransaction(
        txHash: string,
        expectedAmount: number,
        merchantAddress: string,
        tokenDecimals: number = 18
    ): Promise<ValidationResult> {
        this.logger.log(`Validating transaction ${txHash} for expected amount ${expectedAmount}`);

        try {
            // Moralis initialization should technically happen in a module hook
            if (!Moralis.Core.isStarted) {
                await Moralis.start({
                    apiKey: process.env.MORALIS_API_KEY,
                });
            }

            const response = await Moralis.EvmApi.transaction.getTransaction({
                transactionHash: txHash,
                chain: EvmChain.BSC, // BSC as per requirements
            });

            if (!response) {
                this.logger.error(`Transaction ${txHash} not found`);
                return { status: TransactionStatus.REFUSED };
            }

            const transaction = response.toJSON();

            // 1. Verify receipt_status is 1 (Success)
            if ((transaction as any).receiptStatus !== 1 && (transaction as any).receipt_status !== 1) {
                this.logger.warn(`Transaction ${txHash} failed on-chain`);
                return { status: TransactionStatus.REFUSED };
            }

            // 2. Verify receiver address
            const receiverAddress = (transaction as any).toAddress || (transaction as any).to_address;
            if (receiverAddress?.toLowerCase() !== merchantAddress.toLowerCase()) {
                this.logger.warn(`Transaction ${txHash} recipient mismatch`);
                return { status: TransactionStatus.REFUSED };
            }

            // 3. Compare amount with tolerance
            const receivedValue = new Decimal(transaction.value).dividedBy(new Decimal(10).pow(tokenDecimals));
            const expected = new Decimal(expectedAmount);
            // 0.5% tolerance
            const tolerance = expected.times(0.005);
            const minAccepted = expected.minus(tolerance);

            if (receivedValue.lt(minAccepted)) {
                const missing = expected.minus(receivedValue);
                this.logger.warn(`Transaction ${txHash} PARTIAL PAYMENT: Recu ${receivedValue}, Attendu ${expected}. Manque ${missing}`);

                await this.updateTransactionStatus(txHash, TransactionStatus.PARTIAL_PAYMENT);
                return {
                    status: TransactionStatus.PARTIAL_PAYMENT,
                    missingAmount: missing.toNumber(),
                    receivedAmount: receivedValue.toNumber()
                };
            }

            this.logger.log(`Transaction ${txHash} validated successfully`);
            await this.updateTransactionStatus(txHash, TransactionStatus.VALIDATED);
            return { status: TransactionStatus.VALIDATED };

        } catch (error) {
            this.logger.error(`Error validating transaction ${txHash}: ${error.message}`);
            return { status: TransactionStatus.PENDING }; // Keep as pending if error occurs to retry
        }
    }

    private async updateTransactionStatus(txHash: string, status: TransactionStatus) {
        const tx = await (this.prisma as any).transaction.findUnique({
            where: { tx_hash: txHash },
        });

        if (tx) {
            await (this.prisma as any).transaction.update({
                where: { tx_hash: txHash },
                data: { status },
            });
        }
    }
}
