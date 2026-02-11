import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';

export interface PriceQuote {
    provider: string;
    cryptoAmount: Decimal;
    networkFee: Decimal;
    totalWithFee: Decimal;
    rate: Decimal;
    latencyMs: number; // Simulated latency
}

export interface IPriceProvider {
    name: string;
    getQuote(fiatAmount: number, targetCrypto: string): Promise<PriceQuote>;
}

@Injectable()
export class PriceEngineService {
    private readonly logger = new Logger(PriceEngineService.name);
    private providers: IPriceProvider[] = [];

    constructor() {
        // Initializing providers (Stubs/Mocks as per requirements) with simulated latency
        this.providers = [
            {
                name: 'Moralis',
                getQuote: async (amount, crypto) => {
                    const latency = Math.floor(Math.random() * 200) + 50; // 50-250ms
                    await new Promise(r => setTimeout(r, latency));
                    return {
                        provider: 'Moralis',
                        cryptoAmount: new Decimal(amount).times(0.000045), // Dummy rate
                        networkFee: new Decimal(0.0005),
                        totalWithFee: new Decimal(amount).times(0.000045).plus(0.0005),
                        rate: new Decimal(0.000045),
                        latencyMs: latency
                    };
                },
            },
            {
                name: 'Binance',
                getQuote: async (amount, crypto) => {
                    const latency = Math.floor(Math.random() * 150) + 20; // 20-170ms (Faster)
                    await new Promise(r => setTimeout(r, latency));
                    return {
                        provider: 'Binance',
                        cryptoAmount: new Decimal(amount).times(0.000046), // Dummy rate
                        networkFee: new Decimal(0.0002),
                        totalWithFee: new Decimal(amount).times(0.000046).plus(0.0002),
                        rate: new Decimal(0.000046),
                        latencyMs: latency
                    };
                },
            },
            {
                name: 'Kraken',
                getQuote: async (amount, crypto) => {
                    const latency = Math.floor(Math.random() * 300) + 100; // 100-400ms (Slower)
                    await new Promise(r => setTimeout(r, latency));
                    return {
                        provider: 'Kraken',
                        cryptoAmount: new Decimal(amount).times(0.0000455), // Dummy rate
                        networkFee: new Decimal(0.0003),
                        totalWithFee: new Decimal(amount).times(0.0000455).plus(0.0003),
                        rate: new Decimal(0.0000455),
                        latencyMs: latency
                    };
                },
            },
        ];
    }

    async getBestQuote(fiatAmount: number, targetCrypto: string): Promise<PriceQuote> {
        this.logger.log(`Fetching best quote for ${fiatAmount} to ${targetCrypto}`);
        const start = Date.now();

        const quotes = await Promise.all(
            this.providers.map(p => p.getQuote(fiatAmount, targetCrypto))
        );

        const duration = Date.now() - start;
        this.logger.log(`Fetched ${quotes.length} quotes in ${duration}ms`);

        // Sorting by Total Cost (Lowest is best for the customer)
        const bestQuote = quotes.reduce((prev, current) => {
            return current.totalWithFee.lt(prev.totalWithFee) ? current : prev;
        });

        this.logger.log(`Best quote: ${bestQuote.provider} - Cost: ${bestQuote.totalWithFee} (${bestQuote.cryptoAmount} + ${bestQuote.networkFee} fee) - Latency: ${bestQuote.latencyMs}ms`);
        return bestQuote;
    }
}
