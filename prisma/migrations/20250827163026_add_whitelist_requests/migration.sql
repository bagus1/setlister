-- CreateEnum
CREATE TYPE "public"."enum_band_invitations_role" AS ENUM ('member');

-- CreateEnum
CREATE TYPE "public"."enum_band_members_role" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "public"."enum_gig_documents_type" AS ENUM ('chords', 'bass-tab', 'guitar-tab', 'lyrics');

-- CreateEnum
CREATE TYPE "public"."enum_links_type" AS ENUM ('youtube', 'spotify', 'apple-music', 'soundcloud', 'bandcamp', 'lyrics', 'tab', 'bass tab', 'chords', 'guitar tutorial', 'bass tutorial', 'keyboard tutorial', 'audio', 'sheet-music', 'backing-track', 'karaoke', 'horn chart', 'other', 'video');

-- CreateEnum
CREATE TYPE "public"."enum_medleys_key" AS ENUM ('C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm');

-- CreateEnum
CREATE TYPE "public"."enum_setlist_sets_name" AS ENUM ('Set 1', 'Set 2', 'Set 3', 'Set 4', 'Maybe');

-- CreateEnum
CREATE TYPE "public"."enum_songs_key" AS ENUM ('C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm');

-- CreateEnum
CREATE TYPE "public"."enum_whitelist_request_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vocalists" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vocalists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."artists" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bands" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."band_members" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "band_id" INTEGER NOT NULL,
    "role" "public"."enum_band_members_role" DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "band_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."songs" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "key" "public"."enum_songs_key",
    "time" INTEGER,
    "bpm" INTEGER,
    "vocalist_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."band_songs" (
    "id" SERIAL NOT NULL,
    "band_id" INTEGER NOT NULL,
    "song_id" INTEGER NOT NULL,
    "gig_document_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "band_songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gig_documents" (
    "id" SERIAL NOT NULL,
    "song_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "type" "public"."enum_gig_documents_type" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gig_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."setlists" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "band_id" INTEGER NOT NULL,
    "date" TIMESTAMPTZ(6),
    "is_finalized" BOOLEAN DEFAULT false,
    "recordings_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "setlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."setlist_sets" (
    "id" SERIAL NOT NULL,
    "setlist_id" INTEGER NOT NULL,
    "name" "public"."enum_setlist_sets_name" NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "setlist_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."setlist_songs" (
    "id" SERIAL NOT NULL,
    "setlist_set_id" INTEGER NOT NULL,
    "song_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "setlist_songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."medleys" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "key" "public"."enum_medleys_key",
    "vocalist_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medleys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."medley_songs" (
    "id" SERIAL NOT NULL,
    "medley_id" INTEGER NOT NULL,
    "song_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medley_songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."band_invitations" (
    "id" UUID NOT NULL,
    "band_id" INTEGER NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "role" "public"."enum_band_invitations_role" DEFAULT 'member',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "invited_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "band_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."song_artists" (
    "song_id" INTEGER NOT NULL,
    "artist_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "song_artists_pkey" PRIMARY KEY ("song_id","artist_id")
);

-- CreateTable
CREATE TABLE "public"."links" (
    "id" SERIAL NOT NULL,
    "song_id" INTEGER NOT NULL,
    "type" "public"."enum_links_type" NOT NULL,
    "description" VARCHAR(255),
    "url" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_resets" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SequelizeMeta" (
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "public"."whitelist_requests" (
    "id" SERIAL NOT NULL,
    "linkType" "public"."enum_links_type" NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "reason" TEXT NOT NULL,
    "example_url" VARCHAR(500) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "status" "public"."enum_whitelist_request_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "whitelist_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "artists_name_key" ON "public"."artists"("name");

-- CreateIndex
CREATE UNIQUE INDEX "band_members_user_id_band_id" ON "public"."band_members"("user_id", "band_id");

-- CreateIndex
CREATE UNIQUE INDEX "band_songs_band_id_song_id" ON "public"."band_songs"("band_id", "song_id");

-- CreateIndex
CREATE UNIQUE INDEX "gig_documents_song_id_type_version" ON "public"."gig_documents"("song_id", "type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "setlist_sets_setlist_id_name" ON "public"."setlist_sets"("setlist_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "medley_songs_medley_id_song_id" ON "public"."medley_songs"("medley_id", "song_id");

-- CreateIndex
CREATE UNIQUE INDEX "band_invitations_token_key" ON "public"."band_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "public"."password_resets"("token");

-- AddForeignKey
ALTER TABLE "public"."bands" ADD CONSTRAINT "bands_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."band_members" ADD CONSTRAINT "band_members_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."band_members" ADD CONSTRAINT "band_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."songs" ADD CONSTRAINT "songs_vocalist_id_fkey" FOREIGN KEY ("vocalist_id") REFERENCES "public"."vocalists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."band_songs" ADD CONSTRAINT "band_songs_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."band_songs" ADD CONSTRAINT "band_songs_gig_document_id_fkey" FOREIGN KEY ("gig_document_id") REFERENCES "public"."gig_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."band_songs" ADD CONSTRAINT "band_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."gig_documents" ADD CONSTRAINT "gig_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."gig_documents" ADD CONSTRAINT "gig_documents_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."setlists" ADD CONSTRAINT "setlists_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."setlist_sets" ADD CONSTRAINT "setlist_sets_setlist_id_fkey" FOREIGN KEY ("setlist_id") REFERENCES "public"."setlists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."setlist_songs" ADD CONSTRAINT "setlist_songs_setlist_set_id_fkey" FOREIGN KEY ("setlist_set_id") REFERENCES "public"."setlist_sets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."setlist_songs" ADD CONSTRAINT "setlist_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."medleys" ADD CONSTRAINT "medleys_vocalist_id_fkey" FOREIGN KEY ("vocalist_id") REFERENCES "public"."vocalists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."medley_songs" ADD CONSTRAINT "medley_songs_medley_id_fkey" FOREIGN KEY ("medley_id") REFERENCES "public"."medleys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."medley_songs" ADD CONSTRAINT "medley_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."band_invitations" ADD CONSTRAINT "band_invitations_band_id_fkey" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."band_invitations" ADD CONSTRAINT "band_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."song_artists" ADD CONSTRAINT "song_artists_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."song_artists" ADD CONSTRAINT "song_artists_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."links" ADD CONSTRAINT "links_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
