-- CreateEnum
CREATE TYPE "TripBudgetCategory" AS ENUM ('ACCOMMODATION', 'TRANSPORT', 'FOOD', 'ACTIVITIES', 'OTHER');

-- CreateTable
CREATE TABLE "trip_budgets" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_planned_expenses" (
    "id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "category" "TripBudgetCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" VARCHAR(180),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_planned_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_budgets_trip_id_key" ON "trip_budgets"("trip_id");

-- CreateIndex
CREATE INDEX "trip_planned_expenses_budget_id_category_idx" ON "trip_planned_expenses"("budget_id", "category");

-- CreateIndex
CREATE INDEX "trip_planned_expenses_budget_id_created_at_idx" ON "trip_planned_expenses"("budget_id", "created_at");

-- AddForeignKey
ALTER TABLE "trip_budgets" ADD CONSTRAINT "trip_budgets_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_planned_expenses" ADD CONSTRAINT "trip_planned_expenses_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "trip_budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
