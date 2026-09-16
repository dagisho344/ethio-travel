-- Phase 14A: additive category-specific extensions for the existing Service aggregate.
-- Existing services remain valid without a detail record. No service, booking, payment,
-- review, media, availability, or audit history is changed or removed.

-- CreateTable
CREATE TABLE "accommodation_details" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "star_class" INTEGER,
    "check_in_time" CHAR(5),
    "check_out_time" CHAR(5),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodation_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" UUID NOT NULL,
    "accommodation_detail_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" VARCHAR(1000),
    "capacity" INTEGER NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_details" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "cuisine_types" VARCHAR(80)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(80)[],
    "reservation_supported" BOOLEAN NOT NULL DEFAULT false,
    "delivery_supported" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_menus" (
    "id" UUID NOT NULL,
    "restaurant_detail_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_menu_items" (
    "id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "section" VARCHAR(120),
    "name" VARCHAR(180) NOT NULL,
    "description" VARCHAR(1000),
    "price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_details" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "duration_days" INTEGER,
    "difficulty" VARCHAR(40),
    "meeting_point" VARCHAR(240),
    "inclusions" VARCHAR(300)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(300)[],
    "exclusions" VARCHAR(300)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(300)[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_itinerary_items" (
    "id" UUID NOT NULL,
    "tour_detail_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" VARCHAR(2000),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_itinerary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_details" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "mode" VARCHAR(40),
    "operator_name" VARCHAR(180),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_routes" (
    "id" UUID NOT NULL,
    "transport_detail_id" UUID NOT NULL,
    "origin_city_id" UUID NOT NULL,
    "destination_city_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_schedules" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "departure_at" TIMESTAMP(3) NOT NULL,
    "arrival_at" TIMESTAMP(3) NOT NULL,
    "fare" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accommodation_details_service_id_key" ON "accommodation_details"("service_id");

-- CreateIndex
CREATE INDEX "room_types_accommodation_detail_id_idx" ON "room_types"("accommodation_detail_id");

-- CreateIndex
CREATE INDEX "room_types_accommodation_detail_id_is_active_idx" ON "room_types"("accommodation_detail_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_details_service_id_key" ON "restaurant_details"("service_id");

-- CreateIndex
CREATE INDEX "restaurant_menus_restaurant_detail_id_idx" ON "restaurant_menus"("restaurant_detail_id");

-- CreateIndex
CREATE INDEX "restaurant_menus_restaurant_detail_id_is_active_idx" ON "restaurant_menus"("restaurant_detail_id", "is_active");

-- CreateIndex
CREATE INDEX "restaurant_menus_restaurant_detail_id_sort_order_idx" ON "restaurant_menus"("restaurant_detail_id", "sort_order");

-- CreateIndex
CREATE INDEX "restaurant_menu_items_menu_id_idx" ON "restaurant_menu_items"("menu_id");

-- CreateIndex
CREATE INDEX "restaurant_menu_items_menu_id_available_idx" ON "restaurant_menu_items"("menu_id", "available");

-- CreateIndex
CREATE INDEX "restaurant_menu_items_menu_id_sort_order_idx" ON "restaurant_menu_items"("menu_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "tour_details_service_id_key" ON "tour_details"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "tour_itinerary_items_tour_detail_id_day_number_sort_order_key" ON "tour_itinerary_items"("tour_detail_id", "day_number", "sort_order");

-- CreateIndex
CREATE INDEX "tour_itinerary_items_tour_detail_id_sort_order_idx" ON "tour_itinerary_items"("tour_detail_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "transport_details_service_id_key" ON "transport_details"("service_id");

-- CreateIndex
CREATE INDEX "transport_routes_transport_detail_id_idx" ON "transport_routes"("transport_detail_id");

-- CreateIndex
CREATE INDEX "transport_routes_origin_city_id_destination_city_id_idx" ON "transport_routes"("origin_city_id", "destination_city_id");

-- CreateIndex
CREATE INDEX "transport_schedules_route_id_departure_at_idx" ON "transport_schedules"("route_id", "departure_at");

-- CreateIndex
CREATE INDEX "transport_schedules_is_active_departure_at_idx" ON "transport_schedules"("is_active", "departure_at");

-- AddForeignKey
ALTER TABLE "accommodation_details" ADD CONSTRAINT "accommodation_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_accommodation_detail_id_fkey" FOREIGN KEY ("accommodation_detail_id") REFERENCES "accommodation_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_details" ADD CONSTRAINT "restaurant_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_menus" ADD CONSTRAINT "restaurant_menus_restaurant_detail_id_fkey" FOREIGN KEY ("restaurant_detail_id") REFERENCES "restaurant_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_menu_items" ADD CONSTRAINT "restaurant_menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "restaurant_menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_details" ADD CONSTRAINT "tour_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_itinerary_items" ADD CONSTRAINT "tour_itinerary_items_tour_detail_id_fkey" FOREIGN KEY ("tour_detail_id") REFERENCES "tour_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_details" ADD CONSTRAINT "transport_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_transport_detail_id_fkey" FOREIGN KEY ("transport_detail_id") REFERENCES "transport_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_origin_city_id_fkey" FOREIGN KEY ("origin_city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_destination_city_id_fkey" FOREIGN KEY ("destination_city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_schedules" ADD CONSTRAINT "transport_schedules_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
