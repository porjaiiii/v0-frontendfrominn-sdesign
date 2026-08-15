// Single source of truth for the LearnDo "points" Google Apps Script web app.
// This script is bound to the points spreadsheet (tabs: points_account,
// points_monthly, co2_collection, points_transactions).
//
// If you redeploy the Apps Script (Deploy → Manage deployments → New version),
// update this URL only — every route imports it from here.
export const POINTS_SCRIPT_URL = process.env.NEXT_PUBLIC_GAS_URL2 ?? ''
