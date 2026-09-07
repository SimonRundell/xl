-- ---------------------------------------------------------------------------
-- XL - browser spreadsheet trainer
-- MySQL schema
--
-- Import with:
--   mysql -u root -p < api/schema.sql
--
-- Creates the database `xl`, the tables, and one default admin account:
--   email    : admin@xl.local
--   password : ChangeMe!123
-- Change that password on first login.
--
-- Tables are prefixed with `xl_` so this database can be shared with other
-- applications. The prefix must match "tablePrefix" in api/config.json.
-- ---------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS `xl`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `xl`;

-- ---------------------------------------------------------------------------
-- xl_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `xl_users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`         VARCHAR(190) NOT NULL,
  `screen_name`   VARCHAR(80)  NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_path`   VARCHAR(255) DEFAULT NULL,
  `is_admin`      TINYINT(1)   NOT NULL DEFAULT 0,
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `preferences`   JSON         DEFAULT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_xl_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- xl_workbooks
-- The whole workbook (sheets, cells, styles, settings) is stored as one
-- JSON document. Simple to save and load, fine for classroom sized sheets.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `xl_workbooks` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `name`       VARCHAR(120) NOT NULL,
  `document`   LONGTEXT     NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_xl_workbooks_user` (`user_id`),
  CONSTRAINT `fk_xl_workbooks_user`
    FOREIGN KEY (`user_id`) REFERENCES `xl_users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- default admin
-- password_hash below is bcrypt for "ChangeMe!123"
-- ---------------------------------------------------------------------------
INSERT INTO `xl_users` (`email`, `screen_name`, `password_hash`, `is_admin`, `is_active`)
SELECT 'admin@xl.local', 'Administrator',
       '$2y$10$GRx0stiSwfLxXwp3RDWxDu.T6h35S4VjQsKCH5VXuwKkjmOxfnv0e', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `xl_users` WHERE `email` = 'admin@xl.local');
