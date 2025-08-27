-- CreateTable
CREATE TABLE "public"."whitelist_domains" (
    "id" SERIAL NOT NULL,
    "linkType" "public"."enum_links_type" NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "pattern" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whitelist_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whitelist_domains_linkType_domain_key" ON "public"."whitelist_domains"("linkType", "domain");
