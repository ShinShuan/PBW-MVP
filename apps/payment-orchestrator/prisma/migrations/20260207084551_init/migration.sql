-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'VALIDATED', 'REFUSED');

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "fiat_amount" DECIMAL(18,2) NOT NULL,
    "fiat_currency" TEXT NOT NULL,
    "crypto_amount" DECIMAL(36,18) NOT NULL,
    "crypto_currency" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "tx_hash" TEXT,
    "audit_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tx_hash_key" ON "transactions"("tx_hash");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_audit_hash_key" ON "transactions"("audit_hash");
