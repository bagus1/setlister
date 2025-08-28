-- AlterTable
ALTER TABLE "songs" ADD COLUMN "created_by_id" INTEGER,
ADD COLUMN "private" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
