ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "NameKana" varchar(128);

ALTER TABLE "Registrations"
    ADD COLUMN IF NOT EXISTS "NameKana" varchar(128);
