// Single source of truth for the LearnDo "points" Google Apps Script web app.
// This script is bound to the points spreadsheet (tabs: points_account,
// points_monthly, co2_collection, points_transactions).
//
// If you redeploy the Apps Script (Deploy → Manage deployments → New version),
// update this URL only — every route imports it from here.
export const POINTS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwrTugtTi7xchC91m1A6X00r6sy6YXh4LM_jBzO-OC2fg4shU3RD_MW1gGU125fw0g3/exec'
