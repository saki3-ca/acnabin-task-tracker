/**
 * ACNABIN Task Tracker - daily Supabase backup to Google Drive.
 *
 * Runs in your own Google account (script.google.com). Once a day it reads
 * every table from Supabase and saves one zip of JSON files to a Drive
 * folder, then deletes backups older than KEEP_DAYS. Emails you on failure.
 *
 * Setup:
 *   1. script.google.com -> New project -> paste this file.
 *   2. Project Settings (gear) -> Script Properties -> add:
 *        SUPABASE_URL          https://<project-ref>.supabase.co
 *        SUPABASE_SERVICE_KEY  the SECRET key (Supabase -> Project Settings -> API Keys)
 *        BACKUP_FOLDER_ID      (optional) Drive folder id; created automatically if empty
 *        KEEP_DAYS             (optional) default 30
 *   3. Run `runBackup` once (approve the permissions), then run
 *      `installDailyTrigger` once to schedule it every night.
 *
 * The secret key bypasses all database security: keep it only in Script
 * Properties, never in this code or anywhere public.
 */

var TABLES = [
  'users',
  'user_credentials',
  'clients',
  'tasks',
  'task_requests',
  'notifications',
  'manager_client_access',
  'manager_student_access',
  'manpower',
  'client_manpower_remarks',
  'manpower_salary',
  'user_personal_info',
  'user_queries',
  'email_log',
  'staff_records',
  'staff_import_log',
  'proposals',
  'proposal_access',
  'proposal_attachments',
  'proposal_settings'
];
var PAGE_SIZE = 1000;
var FOLDER_NAME = 'ACNABIN Task Tracker Backups';

function runBackup() {
  var props = PropertiesService.getScriptProperties();
  try {
    var url = requireProp_(props, 'SUPABASE_URL').replace(/\/+$/, '');
    var key = requireProp_(props, 'SUPABASE_SERVICE_KEY');
    var keepDays = Number(props.getProperty('KEEP_DAYS') || 30);
    var folder = getBackupFolder_(props);

    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
    var blobs = [];
    var summary = [];
    TABLES.forEach(function (table) {
      var rows = fetchTable_(url, key, table);
      if (rows === null) {
        summary.push(table + ': skipped (table not found)');
        return;
      }
      blobs.push(Utilities.newBlob(JSON.stringify(rows, null, 2), 'application/json', table + '.json'));
      summary.push(table + ': ' + rows.length + ' rows');
    });
    blobs.push(Utilities.newBlob(summary.join('\n'), 'text/plain', 'SUMMARY.txt'));

    var zip = Utilities.zip(blobs, 'acnabin-backup-' + stamp + '.zip');
    folder.createFile(zip);
    deleteOldBackups_(folder, keepDays);
    Logger.log('Backup saved: acnabin-backup-' + stamp + '.zip\n' + summary.join('\n'));
  } catch (err) {
    var me = Session.getEffectiveUser().getEmail();
    if (me) {
      MailApp.sendEmail(me, 'ACNABIN backup FAILED', 'The daily Supabase backup failed:\n\n' + (err && err.stack || err));
    }
    throw err;
  }
}

/** Returns all rows of a table, or null if the table doesn't exist. */
function fetchTable_(url, key, table) {
  var headers = { apikey: key };
  // New-format keys (sb_secret_...) must not be sent as a Bearer token;
  // legacy service_role JWT keys need it.
  if (key.indexOf('sb_') !== 0) headers.Authorization = 'Bearer ' + key;

  var all = [];
  for (var offset = 0; ; offset += PAGE_SIZE) {
    var res = UrlFetchApp.fetch(
      url + '/rest/v1/' + table + '?select=*&limit=' + PAGE_SIZE + '&offset=' + offset,
      { headers: headers, muteHttpExceptions: true }
    );
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (code === 404 || (code >= 400 && /PGRST205|does not exist|Could not find the table/i.test(body))) {
      return offset === 0 ? null : all;
    }
    if (code >= 400) {
      throw new Error('Reading "' + table + '" failed (HTTP ' + code + '): ' + body.slice(0, 300));
    }
    var page = JSON.parse(body);
    all = all.concat(page);
    if (page.length < PAGE_SIZE) return all;
  }
}

function getBackupFolder_(props) {
  var id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  var existing = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder = existing.hasNext() ? existing.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

function deleteOldBackups_(folder, keepDays) {
  var cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (/^acnabin-backup-.*\.zip$/.test(f.getName()) && f.getDateCreated().getTime() < cutoff) {
      f.setTrashed(true);
    }
  }
}

function requireProp_(props, name) {
  var value = props.getProperty(name);
  if (!value) throw new Error('Missing Script Property: ' + name);
  return value.trim();
}

/** Run once: schedules runBackup every night around 2 AM (script time zone). */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runBackup') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runBackup').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Daily backup scheduled for ~2 AM.');
}
