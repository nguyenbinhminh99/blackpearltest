-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('completed', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('tai_quay', 'grab', 'shopeefood');

-- CreateTable
CREATE TABLE "orders" (
    "order_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "items" JSONB NOT NULL,
    "discount_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "calculated_total" INTEGER NOT NULL,
    "created_at_vn_date" CHAR(10) NOT NULL,
    "source_batch" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "import_errors" (
    "id" SERIAL NOT NULL,
    "batch_name" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "order_id" TEXT,
    "reason" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" SERIAL NOT NULL,
    "batch_name" TEXT NOT NULL,
    "pulled_at" TIMESTAMP(3),
    "total_rows" INTEGER NOT NULL,
    "inserted" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "skipped_stale" INTEGER NOT NULL,
    "rejected" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_store_id_created_at_vn_date_idx" ON "orders"("store_id", "created_at_vn_date");

-- CreateIndex
CREATE INDEX "orders_status_created_at_vn_date_idx" ON "orders"("status", "created_at_vn_date");

-- CreateIndex
CREATE INDEX "import_errors_batch_name_idx" ON "import_errors"("batch_name");
