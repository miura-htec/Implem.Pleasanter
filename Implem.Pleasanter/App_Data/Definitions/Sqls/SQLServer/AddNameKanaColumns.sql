IF COL_LENGTH('dbo.Users', 'NameKana') IS NULL
BEGIN
    ALTER TABLE [dbo].[Users] ADD [NameKana] nvarchar(128) NULL;
END

IF COL_LENGTH('dbo.Registrations', 'NameKana') IS NULL
BEGIN
    ALTER TABLE [dbo].[Registrations] ADD [NameKana] nvarchar(128) NULL;
END
