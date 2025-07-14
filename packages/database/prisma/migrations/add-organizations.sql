-- Add Organization model
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo_url" TEXT,
    "settings" JSONB DEFAULT '{}',
    "subscription_tier" TEXT DEFAULT 'free',
    "subscription_status" TEXT DEFAULT 'active',
    "trial_ends_at" TIMESTAMP(3),
    "billing_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- Add OrganizationMember model for user-organization relationships
CREATE TABLE IF NOT EXISTS "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by_id" TEXT,
    "invitation_token" TEXT,
    "invitation_accepted_at" TIMESTAMP(3),

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for organization-user pair
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");
CREATE UNIQUE INDEX "organization_members_invitation_token_key" ON "organization_members"("invitation_token");

-- Add foreign keys
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add organization_id to all business entities
ALTER TABLE "items" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "item_categories" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "units_of_measure" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "warehouses" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "suppliers" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "customers" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "shipments" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "returns" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "pos_transactions" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "discounts" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "carriers" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "shipping_methods" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "payment_methods" ADD COLUMN "organization_id" TEXT;

-- Add foreign key constraints
ALTER TABLE "items" ADD CONSTRAINT "items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_transactions" ADD CONSTRAINT "pos_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for organization_id on all tables for performance
CREATE INDEX "items_organization_id_idx" ON "items"("organization_id");
CREATE INDEX "item_categories_organization_id_idx" ON "item_categories"("organization_id");
CREATE INDEX "units_of_measure_organization_id_idx" ON "units_of_measure"("organization_id");
CREATE INDEX "warehouses_organization_id_idx" ON "warehouses"("organization_id");
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");
CREATE INDEX "purchase_orders_organization_id_idx" ON "purchase_orders"("organization_id");
CREATE INDEX "orders_organization_id_idx" ON "orders"("organization_id");
CREATE INDEX "shipments_organization_id_idx" ON "shipments"("organization_id");
CREATE INDEX "returns_organization_id_idx" ON "returns"("organization_id");
CREATE INDEX "pos_transactions_organization_id_idx" ON "pos_transactions"("organization_id");
CREATE INDEX "discounts_organization_id_idx" ON "discounts"("organization_id");
CREATE INDEX "carriers_organization_id_idx" ON "carriers"("organization_id");
CREATE INDEX "shipping_methods_organization_id_idx" ON "shipping_methods"("organization_id");
CREATE INDEX "payment_methods_organization_id_idx" ON "payment_methods"("organization_id");

-- Update unique constraints to include organization_id for proper data isolation
DROP INDEX IF EXISTS "items_sku_key";
CREATE UNIQUE INDEX "items_organization_id_sku_key" ON "items"("organization_id", "sku");

DROP INDEX IF EXISTS "item_categories_name_key";
CREATE UNIQUE INDEX "item_categories_organization_id_name_key" ON "item_categories"("organization_id", "name");

DROP INDEX IF EXISTS "warehouses_code_key";
CREATE UNIQUE INDEX "warehouses_organization_id_code_key" ON "warehouses"("organization_id", "code");

DROP INDEX IF EXISTS "suppliers_supplier_code_key";
CREATE UNIQUE INDEX "suppliers_organization_id_supplier_code_key" ON "suppliers"("organization_id", "supplier_code");

DROP INDEX IF EXISTS "customers_customer_code_key";
CREATE UNIQUE INDEX "customers_organization_id_customer_code_key" ON "customers"("organization_id", "customer_code");

DROP INDEX IF EXISTS "discounts_code_key";
CREATE UNIQUE INDEX "discounts_organization_id_code_key" ON "discounts"("organization_id", "code");