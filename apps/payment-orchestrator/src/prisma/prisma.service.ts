import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Transaction } from '../generated-client';
import * as crypto from 'crypto';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Generates the audit_hash for a transaction.
   * Specification: SHA256(previous_audit_hash + current_data)
   */
  async generateAuditHash(currentData: Partial<Transaction>): Promise<string> {
    const lastTransaction = await (this as any).transaction.findFirst({
      orderBy: { created_at: 'desc' },
      select: { audit_hash: true },
    });

    const previousHash = lastTransaction?.audit_hash || '0'.repeat(64);

    // Core fields for serialization as per spec
    const dataToHash = JSON.stringify({
      id: currentData.id,
      fiat_amount: currentData.fiat_amount?.toString(),
      crypto_amount: currentData.crypto_amount?.toString(),
      status: currentData.status,
      tx_hash: currentData.tx_hash,
      created_at: currentData.created_at,
    });

    return crypto
      .createHash('sha256')
      .update(previousHash + dataToHash)
      .digest('hex');
  }

  /**
   * Specialized create method that handles audit_hash generation
   */
  async createTransaction(data: any) {
    const tempId = crypto.randomUUID();
    const hash = await this.generateAuditHash({
      ...data,
      id: tempId,
      created_at: new Date(),
    });

    return (this as any).transaction.create({
      data: {
        ...data,
        id: tempId,
        audit_hash: hash,
      },
    });
  }
}
