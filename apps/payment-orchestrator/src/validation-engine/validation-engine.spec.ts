import { Test, TestingModule } from '@nestjs/testing';
import { ValidationEngineService, ValidationResult } from './validation-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '../generated-client';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';
import Decimal from 'decimal.js';

// Mock Moralis
jest.mock('moralis', () => {
    return {
        __esModule: true,
        default: {
            start: jest.fn(),
            Core: { isStarted: false },
            EvmApi: {
                transaction: {
                    getTransaction: jest.fn(),
                },
            },
        },
    };
});

describe('ValidationEngineService', () => {
    let service: ValidationEngineService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        transaction: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ValidationEngineService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<ValidationEngineService>(ValidationEngineService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('validateTransaction', () => {
        const txHash = '0x123';
        const merchantAddress = '0xMerchant';
        const expectedAmount = 100;
        const decimals = 18;

        it('should validate full payment correctly', async () => {
            const mockTx = {
                toJSON: () => ({
                    receiptStatus: 1,
                    toAddress: merchantAddress,
                    value: new Decimal(expectedAmount).times(new Decimal(10).pow(decimals)).toString(),
                }),
            };

            (Moralis.EvmApi.transaction.getTransaction as jest.Mock).mockResolvedValue(mockTx);
            (mockPrismaService.transaction.findUnique as jest.Mock).mockResolvedValue({ tx_hash: txHash });

            const result = await service.validateTransaction(txHash, expectedAmount, merchantAddress, decimals);

            expect(result.status).toBe(TransactionStatus.VALIDATED);
            expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
                where: { tx_hash: txHash },
                data: { status: TransactionStatus.VALIDATED },
            });
        });

        it('should detect partial payment', async () => {
            const sentAmount = 50; // Half payment
            const mockTx = {
                toJSON: () => ({
                    receiptStatus: 1,
                    toAddress: merchantAddress,
                    value: new Decimal(sentAmount).times(new Decimal(10).pow(decimals)).toString(),
                }),
            };

            (Moralis.EvmApi.transaction.getTransaction as jest.Mock).mockResolvedValue(mockTx);
            (mockPrismaService.transaction.findUnique as jest.Mock).mockResolvedValue({ tx_hash: txHash });

            const result = await service.validateTransaction(txHash, expectedAmount, merchantAddress, decimals);

            expect(result.status).toBe(TransactionStatus.PARTIAL_PAYMENT);
            expect(result.missingAmount).toBe(50);
            expect(result.receivedAmount).toBe(50);
            expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
                where: { tx_hash: txHash },
                data: { status: TransactionStatus.PARTIAL_PAYMENT },
            });
        });

        it('should refuse failed transaction', async () => {
            const mockTx = {
                toJSON: () => ({
                    receiptStatus: 0, // Failed
                    toAddress: merchantAddress,
                    value: '0',
                }),
            };

            (Moralis.EvmApi.transaction.getTransaction as jest.Mock).mockResolvedValue(mockTx);

            const result = await service.validateTransaction(txHash, expectedAmount, merchantAddress, decimals);

            expect(result.status).toBe(TransactionStatus.REFUSED);
        });

        it('should refuse transaction to wrong address', async () => {
            const mockTx = {
                toJSON: () => ({
                    receiptStatus: 1,
                    toAddress: '0xWrongAddress',
                    value: new Decimal(expectedAmount).times(new Decimal(10).pow(decimals)).toString(),
                }),
            };

            (Moralis.EvmApi.transaction.getTransaction as jest.Mock).mockResolvedValue(mockTx);

            const result = await service.validateTransaction(txHash, expectedAmount, merchantAddress, decimals);

            expect(result.status).toBe(TransactionStatus.REFUSED);
        });
    });
});
