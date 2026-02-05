import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const signature = req.headers['x-signature'] as string;
    const merchantSecret = process.env.MERCHANT_SHARED_SECRET; // This should be fetched from DB per merchant in a real app

    if (!signature) {
      this.logger.warn('Missing X-Signature header');
      throw new UnauthorizedException('Missing signature');
    }

    if (!merchantSecret) {
      this.logger.error('MERCHANT_SHARED_SECRET not configured');
      throw new UnauthorizedException('Server security misconfiguration');
    }

    // Calculate HMAC-SHA256 of the body
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', merchantSecret);
    const calculatedSignature = hmac.update(payload).digest('hex');

    if (calculatedSignature !== signature) {
      this.logger.warn(`Invalid signature. Expected: ${calculatedSignature}, Got: ${signature}`);
      throw new UnauthorizedException('Invalid signature');
    }

    this.logger.log('Request signature validated');
    next();
  }
}
