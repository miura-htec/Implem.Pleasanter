SET @users_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Users'
      AND COLUMN_NAME = 'NameKana'
);
SET @sql_users := IF(
    @users_exists = 0,
    'ALTER TABLE `Users` ADD COLUMN `NameKana` nvarchar(128) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql_users;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @registrations_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Registrations'
      AND COLUMN_NAME = 'NameKana'
);
SET @sql_registrations := IF(
    @registrations_exists = 0,
    'ALTER TABLE `Registrations` ADD COLUMN `NameKana` nvarchar(128) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql_registrations;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
