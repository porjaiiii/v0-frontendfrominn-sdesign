// ============================================
// CONFIG
// ============================================
const SS = SpreadsheetApp.getActiveSpreadsheet()

const ACCOUNT_SHEET     = 'points_account'
const MONTHLY_SHEET     = 'points_monthly'
const CO2_SHEET         = 'co2_collection'
const TRANSACTION_SHEET = 'points_transactions'
const SPEND_SHEET       = 'spend_details'

const EXPIRE_YEAR  = 2
const EXPIRE_MONTH = 0

const TIMEZONE   = 'Asia/Bangkok'
const LOCK_WAIT  = 10000

const TIERS = [
  { min: 500, name: 'นักอนุรักษ์ระดับผู้เชี่ยวชาญ' },
  { min: 300, name: 'นักอนุรักษ์ระดับสูง' },
  { min: 150, name: 'นักอนุรักษ์ระดับกลาง' },
  { min: 0,   name: 'นักอนุรักษ์มือใหม่' },
]

const DEFAULT_TIER = 'นักอนุรักษ์มือใหม่'

// ============================================
// SHEET HELPERS
// ============================================
function getSheet(sheetName) {
  return SS.getSheetByName(sheetName)
}

function getAllRows(sheetName) {
  const data = getSheet(sheetName).getDataRange().getValues()
  return data.length <= 1 ? [] : data.slice(1)
}

/** Runs fn with a user lock held, releasing it no matter what. */
function withLock(fn) {
  const lock = LockService.getUserLock()
  lock.waitLock(LOCK_WAIT)
  try {
    return fn()
  } finally {
    lock.releaseLock()
  }
}

// ============================================
// ROW MAPPERS
// ============================================
function toAccount(row) {
  return {
    user_id:      row[0],
    total_points: row[1],
    total_weight: row[2],
    total_co2:    row[3],
    tier:         row[4],
    last_updated: row[5],
  }
}

function toTransaction(row) {
  return {
    tx_id:     row[0],
    user_id:   row[1],
    type:      row[2],
    points:    row[3],
    co2:       row[4],
    weight:    row[5],
    timestamp: row[6],
  }
}

function toSpendDetail(row) {
  return {
    tx_id:     row[0],
    user_id:   row[1],
    category:  row[2],
    item_name: row[3],
    quantity:  row[4],
    points:    row[5],
    status:    row[6],
    timestamp: row[7],
  }
}

function toCo2Entry(row) {
  return {
    waste_type:   row[1],
    weight:       Number(row[2]) || 0,
    co2:          Number(row[3]) || 0,
    last_updated: row[4],
  }
}

// ============================================
// LOOKUP HELPERS
// ============================================
/** Returns { row, sheetRow } for a user in points_account, or null. */
function findAccountRow(user_id) {
  const rows = getAllRows(ACCOUNT_SHEET)
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === user_id) {
      return { row: rows[i], sheetRow: i + 2 }
    }
  }
  return null
}

/** Active, unexpired monthly rows for a user. */
function getActiveMonthlyRows(user_id) {
  const now = new Date()
  const result = []

  getAllRows(MONTHLY_SHEET).forEach((row, i) => {
    if (row[0] === user_id && row[6] === 'active' && new Date(row[5]) > now) {
      result.push({
        sheetRow:     i + 2,
        month:        rowMonthToString(row[1]),
        balance:      row[4],
        currentSpent: row[3],
      })
    }
  })

  return result
}

// ============================================
// RESPOND
// ============================================
function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// ============================================
// DATE / MONTH
// ============================================
function now_() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
}

function getCurrentMonth() {
  const now = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`  // e.g. '2026-06'
}

function getExpiresAt(month) {
  const [year, m] = month.split('-')
  // Last day of the same month, EXPIRE_YEAR years later
  const date = new Date(Number(year) + EXPIRE_YEAR, Number(m) + EXPIRE_MONTH, 0)
  return date.toISOString().split('T')[0]  // e.g. '2027-06-30'
}

/** Sheets may hand back a Date for the month column — normalise to 'YYYY-MM'. */
function rowMonthToString(value) {
  if (value instanceof Date) {
    const year  = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
  return value
}

// ============================================
// ENTRY POINT
// ============================================
const ACTIONS = {
  get_or_create_account: getOrCreateAccount,
  get_balance:           getBalance,
  earn_points:           earnPoints,
  spend_points:          spendPoints,
  resync_balance:        resyncBalance,
  get_transactions:      getTransactions,
  get_leaderboard:       getLeaderboard,
  get_spend_details:     getSpendDetails,
  get_co2_collection:    getCo2Collection,
  mark_spend_used:       markSpendUsed,
}

function doGet(e)  { return handleRequest(e) }
function doPost(e) { return handleRequest(e) }

function handleRequest(e) {
  try {
    const params = e.postData
      ? JSON.parse(e.postData.contents)  // POST — parse the body
      : e.parameter                      // GET  — read URL params

    const { action, user_id } = params

    if (!action)  return respond({ success: false, message: 'Missing action' })
    if (!user_id) return respond({ success: false, message: 'Missing user_id' })

    const handler = ACTIONS[action]
    if (!handler) return respond({ success: false, message: `Unknown action: ${action}` })

    return handler(params)

  } catch (err) {
    return respond({ success: false, message: err.message })
  }
}

// ============================================
// ACCOUNT
// ============================================
function getOrCreateAccount(params) {
  const { user_id } = params

  const existing = findAccountRow(user_id)
  if (existing) {
    return respond({
      success: true,
      message: 'Account found',
      account: toAccount(existing.row),
    })
  }

  getSheet(ACCOUNT_SHEET).appendRow([
    user_id, 0, 0, 0, DEFAULT_TIER, new Date().toISOString(),
  ])

  // 🎁 Welcome bonus — remove this when going live
  // earnPoints({
  //   user_id,
  //   points:     1000,
  //   co2:        20,
  //   weight:     10,
  //   waste_type: 'plastic'  // placeholder waste type
  // })

  const created = findAccountRow(user_id)
  if (!created) {
    return respond({ success: false, message: 'Account creation failed' })
  }

  return respond({
    success: true,
    message: 'Account created',
    account: toAccount(created.row),
  })
}

function getBalance(params) {
  const found = findAccountRow(params.user_id)
  if (!found) return respond({ success: false, message: 'Account not found' })

  return respond({ success: true, account: toAccount(found.row) })
}

/** Recalculates total_points from points_monthly and applies weight/co2 deltas. */
function syncAccount(user_id, weight = 0, co2 = 0) {
  const found = findAccountRow(user_id)
  if (!found) return

  const total_points = getActiveMonthlyRows(user_id)
    .reduce((sum, r) => sum + r.balance, 0)

  const new_weight = found.row[2] + weight
  const new_co2    = found.row[3] + co2

  const sheet = getSheet(ACCOUNT_SHEET)
  sheet.getRange(found.sheetRow, 2).setValue(total_points)
  sheet.getRange(found.sheetRow, 3).setValue(new_weight)
  sheet.getRange(found.sheetRow, 4).setValue(new_co2)
  sheet.getRange(found.sheetRow, 5).setValue(getTier(new_weight))
  sheet.getRange(found.sheetRow, 6).setValue(new Date().toISOString())
}

function resyncBalance(params) {
  const { user_id } = params

  if (!findAccountRow(user_id)) {
    return respond({ success: false, message: 'Account not found' })
  }

  syncAccount(user_id)

  const updated = findAccountRow(user_id)
  return respond({
    success: true,
    message: 'Balance resynced',
    total_points: updated ? updated.row[1] : 0,
  })
}

function getTier(total_weight) {
  const tier = TIERS.find(t => total_weight >= t.min)
  return tier ? tier.name : DEFAULT_TIER
}

function getLeaderboard() {
  const accounts = getAllRows(ACCOUNT_SHEET)
    .filter(row => row[0])
    .map(row => {
      const { last_updated, ...rest } = toAccount(row)
      return rest
    })

  return respond({ success: true, accounts, total: accounts.length })
}

// ============================================
// EARN / SPEND
// ============================================
function earnPoints(params) {
  const { user_id, points, co2 = 0, weight = 0, waste_type } = params

  if (!points || points <= 0) {
    return respond({ success: false, message: 'Invalid points value' })
  }

  return withLock(() => {
    const month        = getCurrentMonth()
    const monthlySheet = getSheet(MONTHLY_SHEET)
    const monthlyRows  = getAllRows(MONTHLY_SHEET)

    let found = false

    for (let i = 0; i < monthlyRows.length; i++) {
      const rowMonth = rowMonthToString(monthlyRows[i][1])

      if (monthlyRows[i][0] === user_id && rowMonth === month) {
        monthlySheet.getRange(i + 2, 3).setValue(monthlyRows[i][2] + points)  // earned
        monthlySheet.getRange(i + 2, 5).setValue(monthlyRows[i][4] + points)  // balance
        found = true
        break
      }
    }

    if (!found) {
      monthlySheet.appendRow([
        user_id,
        `'${month}`,
        points,               // earned
        0,                    // spent
        points,               // balance
        getExpiresAt(month),
        'active',
      ])
    }

    logTransaction(user_id, 'earn', points, co2, weight)
    updateCo2Collection(user_id, waste_type, weight, co2)
    syncAccount(user_id, weight, co2)

    return respond({
      success:      true,
      message:      'Points earned',
      points_added: points,
      co2_added:    co2,
    })
  })
}

function spendPoints(params) {
  const { user_id, points } = params

  if (!points || points <= 0) {
    return respond({ success: false, message: 'Invalid points value' })
  }

  return withLock(() => {
    const monthlySheet = getSheet(MONTHLY_SHEET)

    // Oldest cohort first (FIFO)
    const userRows = getActiveMonthlyRows(user_id)
      .sort((a, b) => a.month.localeCompare(b.month))

    const totalBalance = userRows.reduce((sum, r) => sum + r.balance, 0)
    if (totalBalance < points) {
      return respond({
        success:         false,
        message:         'Not enough points',
        current_balance: totalBalance,
        requested:       points,
      })
    }

    let remaining = points

    for (const row of userRows) {
      if (remaining <= 0) break

      const deducted = Math.min(row.balance, remaining)

      monthlySheet.getRange(row.sheetRow, 4).setValue(row.currentSpent + deducted)  // spent
      monthlySheet.getRange(row.sheetRow, 5).setValue(row.balance - deducted)       // balance

      remaining -= deducted
    }

    const tx_id = Utilities.getUuid()
    logTransaction(user_id, 'spend', points, 0, 0, tx_id)
    logSpendDetails(tx_id, user_id, params.category || 'reward', params.items || [])
    syncAccount(user_id)

    return respond({
      success:           true,
      message:           'Points spent',
      points_spent:      points,
      remaining_balance: totalBalance - points,
      tx_id:             tx_id,
    })
  })
}

// ============================================
// TRANSACTIONS
// ============================================
function logTransaction(user_id, type, points, co2, weight, tx_id) {
  getSheet(TRANSACTION_SHEET).appendRow([
    tx_id || Utilities.getUuid(),
    user_id,
    type,
    points,
    co2,
    weight || 0,
    now_(),
  ])
}

function getTransactions(params) {
  const transactions = getAllRows(TRANSACTION_SHEET)
    .filter(row => row[0] !== '' && row[1] === params.user_id)
    .map(toTransaction)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  return respond({ success: true, transactions, total: transactions.length })
}

// ============================================
// SPEND DETAILS
// ============================================
function logSpendDetails(tx_id, user_id, category, items) {
  if (!items || !items.length) return

  const sheet         = getSheet(SPEND_SHEET)
  const timestamp     = now_()
  const defaultStatus = category === 'donate' ? 'บริจาคสำเร็จ' : 'รอใช้งานคูปอง'

  items.forEach(item => {
    sheet.appendRow([
      tx_id,
      user_id,
      category,
      item.name     || '',
      item.quantity || 1,
      item.points   || 0,
      defaultStatus,
      timestamp,
    ])
  })
}

function getSpendDetails(params) {
  const details = getAllRows(SPEND_SHEET)
    .filter(row => row[0] && row[1] === params.user_id)
    .map(toSpendDetail)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  return respond({ success: true, details, total: details.length })
}

function markSpendUsed(params) {
  const { user_id, tx_id } = params

  if (!tx_id) return respond({ success: false, message: 'Missing tx_id' })

  return withLock(() => {
    const sheet = getSheet(SPEND_SHEET)
    const rows  = getAllRows(SPEND_SHEET)
    let updated = 0

    rows.forEach((row, i) => {
      if (row[0] === tx_id && row[1] === user_id) {
        sheet.getRange(i + 2, 7).setValue('ใช้คูปองแล้ว')  // status
        updated++
      }
    })

    return respond({
      success:      true,
      message:      'Spend status updated',
      tx_id:        tx_id,
      rows_updated: updated,
    })
  })
}

// ============================================
// CO2 COLLECTION
// ============================================
function updateCo2Collection(user_id, waste_type, weight, co2) {
  const sheet     = getSheet(CO2_SHEET)
  const rows      = getAllRows(CO2_SHEET)
  const timestamp = now_()

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === user_id && rows[i][1] === waste_type) {
      sheet.getRange(i + 2, 3).setValue(rows[i][2] + weight)  // weight
      sheet.getRange(i + 2, 4).setValue(rows[i][3] + co2)     // co2
      sheet.getRange(i + 2, 5).setValue(timestamp)            // last_updated
      return
    }
  }

  sheet.appendRow([user_id, waste_type, weight, co2, timestamp])
}

function getCo2Collection(params) {
  const collection = getAllRows(CO2_SHEET)
    .filter(row => row[0] === params.user_id)
    .map(toCo2Entry)

  return respond({ success: true, collection, total: collection.length })
}

// ============================================
// EXPIRY — trigger on the 1st of each month
// ============================================
function expirePoints() {
  const monthlySheet  = getSheet(MONTHLY_SHEET)
  const now           = new Date()
  const affectedUsers = []

  getAllRows(MONTHLY_SHEET).forEach((row, i) => {
    if (row[6] === 'active' && new Date(row[5]) < now) {
      monthlySheet.getRange(i + 2, 7).setValue('expired')

      if (!affectedUsers.includes(row[0])) affectedUsers.push(row[0])
    }
  })

  affectedUsers.forEach(user_id => syncAccount(user_id))

  return respond({
    success:        true,
    message:        'Expired rows processed',
    affected_users: affectedUsers.length,
  })
}

// ============================================
// TESTS
// ============================================
const TEST_USER = 'Ubc186a6ab54e978df373bc00298fee32'

function testGetOrCreateAccount() {
  Logger.log(getOrCreateAccount({ user_id: TEST_USER }).getContent())
}

function testEarnPoints() {
  const result = earnPoints({
    user_id:    TEST_USER,
    points:     75,
    co2:        7.5,
    weight:     3,
    waste_type: 'plastic',
  })
  Logger.log(result.getContent())
}

function testSpendPoints() {
  Logger.log('--- Setup: Earn 100 points ---')
  Logger.log(earnPoints({ user_id: 'u_002', points: 100, co2: 50 }).getContent())

  Logger.log('--- Spend 30 points (partial) ---')
  Logger.log(spendPoints({ user_id: 'u_002', points: 30 }).getContent())

  Logger.log('--- Spend 999 points (not enough) ---')
  Logger.log(spendPoints({ user_id: 'u_002', points: 999 }).getContent())
}

function testExpirePoints() {
  getSheet(MONTHLY_SHEET).appendRow([
    'u_001',
    '2024-01',      // old month
    100,            // earned
    0,              // spent
    100,            // balance
    '2026-01-31',   // expires_at — already passed
    'active',
  ])

  Logger.log('--- Inserted fake expired row ---')
  Logger.log(expirePoints().getContent())
}

function testGetTransactions() {
  earnPoints({ user_id: 'u_001', points: 100, co2: 50 })
  earnPoints({ user_id: 'u_001', points: 200, co2: 30 })
  spendPoints({ user_id: 'u_001', points: 50 })

  Logger.log(getTransactions({ user_id: 'u_001' }).getContent())
}

function testEarnWithWaste() {
  const result = earnPoints({
    user_id:    'u_001',
    points:     100,
    co2:        2.5,
    weight:     0.5,
    waste_type: 'plastic',
  })
  Logger.log(result.getContent())
}

function debugMonthlyRows() {
  const month = getCurrentMonth()

  getAllRows(MONTHLY_SHEET).forEach((row, i) => {
    Logger.log(`Row ${i}: user_id="${row[0]}" type=${typeof row[0]}`)
    Logger.log(`Row ${i}: month="${row[1]}" type=${typeof row[1]}`)
    Logger.log(`Match test: ${row[0] === 'u_001'} | ${row[1] === month}`)
  })
}