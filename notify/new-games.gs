/**
 * Froobaloo "new games" email list. Google Apps Script, lives inside a Google Sheet.
 *
 * What it does
 * - Saves signups from the form on froobaloo.com to a "Subscribers" tab.
 * - Handles the unsubscribe link in every email.
 * - Sends a launch email for a new game when you run announceNewGame().
 *
 * SETUP (one time)
 * 1. Create a new Google Sheet, for example "Froobaloo new games".
 * 2. Extensions > Apps Script. Delete the starter code and paste this whole file in.
 *    Save (the disk icon).
 * 3. Deploy > New deployment > gear icon > "Web app".
 *      Description: Froobaloo new games
 *      Execute as: Me
 *      Who has access: Anyone
 *    Click Deploy and authorize it (it is your own script asking to edit this sheet
 *    and send email as you). Copy the "Web app URL". It ends in /exec.
 * 4. Paste that URL into WEBAPP_URL below and save. Then paste it into
 *    NEW_GAMES_ENDPOINT near the bottom of site/index.html in the jtoeman/froobaloo
 *    repo and push. The signup box appears on froobaloo.com after the next deploy.
 * 5. Deploy > Manage deployments > pencil icon > Version: "New version" > Deploy, so
 *    the live web app picks up the URL you pasted in step 4. The /exec URL does not
 *    change when you do this.
 *
 * ANNOUNCING A NEW GAME
 * 1. Fill in GAME_NAME, GAME_URL and GAME_BLURB below and save.
 * 2. Pick sendTestAnnouncement in the function menu at the top and click Run. It
 *    emails only you, so you can check how it looks.
 * 3. Pick announceNewGame and click Run. Each subscriber gets it once per GAME_URL,
 *    so running it again is safe. If Google's daily email limit runs out partway
 *    (about 100 a day on a personal Gmail account, about 1,500 on Google Workspace),
 *    run it again tomorrow and it picks up where it stopped. View > Logs (or
 *    Executions) shows how many were sent.
 *
 * Any edit to doPost or doGet needs step 5 again before the live site sees it.
 * Editing the GAME_ settings or running announceNewGame does not.
 */

// Settings
var WEBAPP_URL = 'PASTE-THE-/exec-URL-HERE';
var SENDER_NAME = 'Froobaloo';

var GAME_NAME = '';   // e.g. 'Wordsummit'
var GAME_URL = '';    // e.g. 'https://froobaloo.com/wordsummit/'
var GAME_BLURB = '';  // one or two sentences about the game

var SUBSCRIBERS_TAB = 'Subscribers';
// Columns: Email | Signed up | Status | Source | Last announced
var COL_EMAIL = 1, COL_SIGNED_UP = 2, COL_STATUS = 3, COL_SOURCE = 4, COL_LAST = 5;

// Signup from the site. The body is plain-text JSON like {"email":"a@b.com","source":"hub"}.
// The page sends it with fetch's no-cors mode and never sees this reply.
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var email = String(body.email || '').trim().toLowerCase();
    var source = String(body.source || '').slice(0, 40);
    if (!isValidEmail_(email)) return ContentService.createTextOutput('invalid email');

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = subscribersSheet_();
      var row = findRow_(sheet, email);
      if (row) {
        // Signing up again undoes an earlier unsubscribe instead of adding a duplicate.
        sheet.getRange(row, COL_STATUS).setValue('active');
      } else {
        sheet.appendRow([email, new Date(), 'active', source, '']);
      }
    } finally {
      lock.releaseLock();
    }
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err.message);
  }
}

// Unsubscribe link: ?action=unsubscribe&email=...&t=<token>
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action !== 'unsubscribe') return page_('Nothing to see here.');
  var email = String(p.email || '').trim().toLowerCase();
  if (!isValidEmail_(email) || p.t !== token_(email)) {
    return page_('That unsubscribe link doesn’t look right. Reply to any Froobaloo email and we’ll take you off the list by hand.');
  }
  var sheet = subscribersSheet_();
  var row = findRow_(sheet, email);
  if (row) sheet.getRange(row, COL_STATUS).setValue('unsubscribed');
  return page_(escapeHtml_(email) + ' won’t get any more Froobaloo emails.<br>Changed your mind? Sign up again at <a href="https://froobaloo.com/">froobaloo.com</a>.');
}

// Sends the launch email to everyone active who hasn't had this one yet.
function announceNewGame() {
  checkGameSettings_();
  var sheet = subscribersSheet_();
  var values = sheet.getDataRange().getValues();
  var sent = 0, skipped = 0, left = 0;

  for (var i = 1; i < values.length; i++) {
    var email = String(values[i][COL_EMAIL - 1]).trim().toLowerCase();
    var status = values[i][COL_STATUS - 1];
    var last = values[i][COL_LAST - 1];
    if (!email || status !== 'active' || last === GAME_URL) { skipped++; continue; }
    if (MailApp.getRemainingDailyQuota() < 1) { left++; continue; }
    sendAnnouncement_(email);
    sheet.getRange(i + 1, COL_LAST).setValue(GAME_URL);
    sent++;
  }

  Logger.log('Sent ' + sent + '. Already had it or unsubscribed: ' + skipped + '.' +
    (left ? ' Daily email limit reached, ' + left + ' still to send. Run this again tomorrow.' : ''));
}

// Sends the launch email only to you, to check it before announcing.
function sendTestAnnouncement() {
  checkGameSettings_();
  var me = Session.getEffectiveUser().getEmail();
  sendAnnouncement_(me);
  Logger.log('Test email sent to ' + me + '.');
}

function sendAnnouncement_(email) {
  var unsubscribe = WEBAPP_URL + '?action=unsubscribe&email=' + encodeURIComponent(email) + '&t=' + token_(email);
  var subject = 'New on Froobaloo: ' + GAME_NAME;
  var text =
    GAME_NAME + ' is live on Froobaloo.\n\n' +
    GAME_BLURB + '\n\n' +
    'Play it: ' + GAME_URL + '\n\n' +
    'You got this because you asked to hear about new games at froobaloo.com.\n' +
    'Unsubscribe: ' + unsubscribe + '\n';
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#221D3D;max-width:520px">' +
    '<p style="font-size:22px;font-weight:bold;margin:0 0 12px">' + escapeHtml_(GAME_NAME) + ' is live on Froobaloo</p>' +
    '<p style="margin:0 0 20px">' + escapeHtml_(GAME_BLURB) + '</p>' +
    '<p style="margin:0 0 28px"><a href="' + escapeHtml_(GAME_URL) + '" style="display:inline-block;background:#6C63E0;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Play ' + escapeHtml_(GAME_NAME) + '</a></p>' +
    '<p style="margin:0;font-size:13px;color:#5E5880">You got this because you asked to hear about new games at <a href="https://froobaloo.com/" style="color:#5E5880">froobaloo.com</a>. ' +
    '<a href="' + escapeHtml_(unsubscribe) + '" style="color:#5E5880">Unsubscribe</a></p>' +
    '</div>';
  MailApp.sendEmail({ to: email, subject: subject, body: text, htmlBody: html, name: SENDER_NAME });
}

function checkGameSettings_() {
  if (!GAME_NAME || !/^https:\/\//.test(GAME_URL) || !GAME_BLURB) {
    throw new Error('Fill in GAME_NAME, GAME_URL (starting with https://) and GAME_BLURB at the top first.');
  }
  if (!/\/exec$/.test(WEBAPP_URL)) {
    throw new Error('Paste the web app /exec URL into WEBAPP_URL first (setup step 4).');
  }
}

// Per-email token so only the real unsubscribe link works. The secret is created on
// first use and kept in this script's properties.
function token_(email) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('UNSUBSCRIBE_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('UNSUBSCRIBE_SECRET', secret);
  }
  var sig = Utilities.computeHmacSha256Signature(email, secret);
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '').slice(0, 22);
}

function subscribersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SUBSCRIBERS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(SUBSCRIBERS_TAB);
    sheet.appendRow(['Email', 'Signed up', 'Status', 'Source', 'Last announced']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow_(sheet, email) {
  var values = sheet.getRange(1, COL_EMAIL, sheet.getLastRow(), 1).getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === email) return i + 1;
  }
  return 0;
}

function isValidEmail_(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function page_(message) {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.5;max-width:480px;margin:48px auto;padding:0 16px;color:#221D3D">' +
    message + '</div>'
  ).setTitle('Froobaloo');
}
