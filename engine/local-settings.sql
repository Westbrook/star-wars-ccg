-- Local development only. Remove public seed accounts before remote hosting.
UPDATE gemp_settings SET settingValue=1 WHERE settingName IN ('aiTablesEnabled','privateGamesEnabled');
