-- CreateTable
CREATE TABLE "WalletTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'QPAY',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentRef" TEXT,
    "qpayInvoiceId" TEXT,
    "qpayPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WalletTopUp_qpayInvoiceId_key" ON "WalletTopUp"("qpayInvoiceId");

-- CreateIndex
CREATE INDEX "WalletTopUp_userId_idx" ON "WalletTopUp"("userId");

-- CreateIndex
CREATE INDEX "WalletTopUp_paymentStatus_idx" ON "WalletTopUp"("paymentStatus");

-- CreateIndex
CREATE INDEX "WalletTopUp_createdAt_idx" ON "WalletTopUp"("createdAt");

-- AddForeignKey
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
