import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';

export interface PriceQuote {
    provider: string;
    cryptoAmount: Decimal;
    networkFee: Decimal;
    totalWithFee: Decimal;
    rate: Decimal;
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
        // Initializing providers (Stubs/Mocks as per requirements)
        this.providers = [
            {
                name: 'Moralis',
                getQuote: async (amount, crypto) => ({
                    provider: 'Moralis',
                    cryptoAmount: new Decimal(amount).times(0.000045), // Dummy rate
                    networkFee: new Decimal(0.0005),
                    totalWithFee: new Decimal(amount).times(0.000045).plus(0.0005),
                    rate: new Decimal(0.000045),
                }),
            },
            {
                name: 'Binance',
                getQuote: async (amount, crypto) => ({
                    provider: 'Binance',
                    cryptoAmount: new Decimal(amount).times(0.000046), // Dummy rate
                    networkFee: new Decimal(0.0002),
                    totalWithFee: new Decimal(amount).times(0.000046).plus(0.0002),
                    rate: new Decimal(0.000046),
                }),
            },
        ];
    }

    async getBestQuote(fiatAmount: number, targetCrypto: string): Promise<PriceQuote> {
        this.logger.log(`Fetching best quote for ${fiatAmount} to ${targetCrypto}`);

        const quotes = await Promise.all(
            this.providers.map(p => p.getQuote(fiatAmount, targetCrypto))
        );

        // Sorting by Total Cost (Lowest is best for the customer)
        // Coût Total = (Montant Crypto * Taux Exchange) + Frais de Transfert (Gas)
        // In our case, the provider's totalWithFee already includes the calculated amount and fees.
        const bestQuote = quotes.reduce((prev, current) => {
            return current.totalWithFee.lt(prev.totalWithFee) ? current : prev;
        });

        this.logger.log(`Best quote found via ${bestQuote.provider}: Total Cost ${bestQuote.totalWithFee} (Crypto: ${bestQuote.cryptoAmount}, Fee: ${bestQuote.networkFee})`);
        return bestQuote;
    }
}
