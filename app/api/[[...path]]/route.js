import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'investers-blueprint-super-secret-key-2025'
const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'investers_blueprint'

let _client = null
async function getDb() {
  if (!_client) { _client = new MongoClient(MONGO_URL); await _client.connect() }
  return _client.db(DB_NAME)
}

const J = (d, s = 200) => NextResponse.json(d, { status: s })
const err = (m, s = 400) => J({ error: m }, s)
const signToken = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: '30d' })

function shortCode(len = 8) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)]
  return s
}

function clientIP(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown'
}

function ensureWallets(u) {
  if (!u.wallets) {
    u.wallets = { main: +u.walletBalance || 0, profit: 0, referral: 0, bonus: 0 }
  }
  return u
}
const totalBalance = (w) => +((w.main || 0) + (w.profit || 0) + (w.referral || 0) + (w.bonus || 0)).toFixed(2)

async function getAuth(request) {
  const h = request.headers.get('authorization') || ''
  const t = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!t) return null
  try { return jwt.verify(t, JWT_SECRET) } catch { return null }
}
async function requireUser(request) {
  const a = await getAuth(request); if (!a) return { error: err('Unauthorized', 401) }
  const db = await getDb()
  const user = await db.collection('users').findOne({ id: a.id })
  if (!user) return { error: err('User not found', 401) }
  if (user.blocked) return { error: err('Account blocked', 403) }
  delete user._id; ensureWallets(user)
  return { user, db }
}
async function requireAdmin(request) {
  const r = await requireUser(request); if (r.error) return r
  if (r.user.role !== 'admin') return { error: err('Admin only', 403) }
  return r
}

// ---------- Seed ----------
let _seeded = false
async function seed(db) {
  if (_seeded) return; _seeded = true
  const settingsCol = db.collection('settings')
  if (!(await settingsCol.findOne({ id: 'global' }))) {
    await settingsCol.insertOne({
      id: 'global',
      siteName: 'Investers Blueprint',
      logo: '', favicon: '',
      currency: { code: 'USD', symbol: '$' },
      timezone: 'UTC', language: 'en',
      themeColors: { primary: '#f5c842', secondary: '#3b82f6' },
      maintenanceMode: false, maintenanceMessage: 'We will be back soon.',
      seo: { metaTitle: 'Investers Blueprint — Premium Investment Platform', metaDescription: 'Build wealth with smart investments. Daily profit, 3-level referrals.', ogImage: '' },
      referral: { levels: [10, 5, 2], maxLevels: 3, enabled: true, signupBonus: 0 },
      collectionIntervalHours: 24, collectEnabled: true, autoExpireEnabled: true,
      rechargeEnabled: true, autoApproveRecharge: false, minRecharge: 10, maxRecharge: 100000,
      withdrawEnabled: true, minWithdraw: 10, maxWithdraw: 50000, dailyWithdrawLimit: 10000, withdrawFeePct: 5, processingTimeHours: 24,
      giftEnabled: true, registrationEnabled: true,
      paymentMethods: [
        { id: uuidv4(), type: 'UPI', name: 'UPI Direct', details: 'investers@upi', qrCode: '', enabled: true },
        { id: uuidv4(), type: 'Bank', name: 'HDFC Bank', details: 'A/c 1234567890 IFSC HDFC0000123', qrCode: '', enabled: true },
        { id: uuidv4(), type: 'Crypto', name: 'USDT (TRC20)', details: 'TXyZAbC123...', qrCode: '', enabled: true },
      ],
      bannerSlides: [
        { id: uuidv4(), image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&q=80', title: 'Build Wealth, Daily.', subtitle: 'Earn up to 300% returns with premium plans.', ctaText: 'Browse Plans', ctaLink: 'plans' },
        { id: uuidv4(), image: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=1600&q=80', title: 'Refer & Earn 10%', subtitle: '3-level commission on every collection.', ctaText: 'Invite Friends', ctaLink: 'team' },
      ],
      popup: { enabled: true, title: 'Welcome!', message: 'Get $5 signup bonus on first deposit.', image: '', ctaText: 'Recharge Now', ctaLink: 'recharge' },
      announcements: [
        { id: uuidv4(), title: 'New Plans Live', message: 'Platinum plan now offers 13% daily.', createdAt: new Date() },
        { id: uuidv4(), title: 'Referral Boost', message: 'Earn 10/5/2% on 3 levels.', createdAt: new Date() },
      ],
      testimonials: [
        { id: uuidv4(), name: 'Aarav S.', role: 'Investor', avatar: '', text: 'Withdrew my first $500 in 2 weeks. Best platform!', rating: 5 },
        { id: uuidv4(), name: 'Priya M.', role: 'Top Referrer', avatar: '', text: 'Made $2k in referral income. The leaderboard is fire.', rating: 5 },
        { id: uuidv4(), name: 'Daniel K.', role: 'Pro Trader', avatar: '', text: 'Daily collection is seamless and instant.', rating: 5 },
      ],
      contact: { email: 'support@investers.io', phone: '+1 800 INV-PRMR', address: '123 Wall Street, NY', telegram: 't.me/investers', whatsapp: '+1234567890', businessName: 'Investers Blueprint LLC', telegramChannel: 't.me/investers_official', workingHours: 'Mon-Sat · 9:00 AM – 9:00 PM (UTC)', responseTime: 'Within 24 hours' },
      social: {
        telegram: { enabled: true, url: 'https://t.me/investers' },
        whatsapp: { enabled: true, url: 'https://wa.me/1234567890' },
        facebook: { enabled: false, url: 'https://facebook.com/investers' },
        instagram: { enabled: false, url: 'https://instagram.com/investers' },
        twitter: { enabled: true, url: 'https://twitter.com/investers' },
        youtube: { enabled: true, url: 'https://youtube.com/investers' },
        discord: { enabled: false, url: '' },
        website: { enabled: true, url: 'https://investers.io' },
      },
      floatingSupportEnabled: true,
      supportCategories: ['Recharge Problem', 'Withdrawal Problem', 'INR to USD Deposit Problem', 'Other Query'],
      socialLinks: [
        { name: 'Telegram', url: 'https://t.me/investers' },
        { name: 'Twitter', url: 'https://twitter.com/investers' },
        { name: 'YouTube', url: 'https://youtube.com/investers' },
      ],
      disclaimer: {
        enabled: true,
        title: 'Investment Disclaimer',
        message: 'Please read all investment plans, risks, validity, profit details, and terms carefully before making any investment. By continuing, you acknowledge that you understand the investment process.',
        acceptText: 'I Understand',
        viewTermsText: 'View Terms',
        color: '#f5c842',
      },
      faq: [
        { q: 'How do I start investing?', a: 'Sign up, recharge your wallet, and purchase any plan.' },
        { q: 'How is daily profit collected?', a: 'Open Orders and click Collect every 24 hours (interval configurable).' },
        { q: 'How do referrals work?', a: 'You earn % commission on your referrals\' daily profit collections across multiple levels.' },
        { q: 'Minimum withdrawal?', a: 'Set by admin in real-time (see Mine → Withdraw).' },
      ],
      pages: {
        about: '<h2>About Us</h2><p>Investers Blueprint is a premium investment platform.</p>',
        terms: '<h2>Terms of Service</h2><p>By using our platform you agree to these terms…</p>',
        privacy: '<h2>Privacy Policy</h2><p>We respect your privacy…</p>',
        refund: '<h2>Refund Policy</h2><p>All purchases are final unless otherwise stated…</p>',
        contact: '<h2>Contact</h2><p>Reach us at support@investers.io</p>',
        blog: [],
      },
    })
  }
  const usersCol = db.collection('users')
  if (!(await usersCol.findOne({ email: 'admin@investers.io' }))) {
    const h = await bcrypt.hash('admin123', 8)
    await usersCol.insertOne({
      id: uuidv4(), email: 'admin@investers.io', password: h, name: 'Admin', phone: '', role: 'admin',
      wallets: { main: 0, profit: 0, referral: 0, bonus: 0 }, todayIncome: 0, todayIncomeDate: '',
      rechargeTotal: 0, withdrawTotal: 0, investmentTotal: 0, totalProfit: 0, referralIncome: 0,
      referralCode: 'ADMIN01', referredBy: null, blocked: false, createdAt: new Date(),
    })
  }
  if (!(await usersCol.findOne({ email: 'demo@investers.io' }))) {
    const h = await bcrypt.hash('demo123', 8)
    await usersCol.insertOne({
      id: uuidv4(), email: 'demo@investers.io', password: h, name: 'Demo User', phone: '', role: 'user',
      wallets: { main: 500, profit: 0, referral: 0, bonus: 0 }, todayIncome: 0, todayIncomeDate: '',
      rechargeTotal: 500, withdrawTotal: 0, investmentTotal: 0, totalProfit: 0, referralIncome: 0,
      referralCode: 'DEMO01', referredBy: null, blocked: false, createdAt: new Date(),
    })
  }
  const plansCol = db.collection('plans')
  if ((await plansCol.countDocuments()) === 0) {
    const imgs = [
      'https://images.unsplash.com/photo-1596518433611-6f099bf4be3c?w=800&q=80',
      'https://images.unsplash.com/photo-1629877522069-fe27cd719feb?w=800&q=80',
      'https://images.unsplash.com/photo-1643270869468-c1522976b91c?w=800&q=80',
      'https://images.unsplash.com/photo-1623773458482-0d47c9622ee7?w=800&q=80',
    ]
    const starters = [
      { name: 'Starter', investAmount: 100, dailyProfit: 10, validityDays: 30, category: 'Basic' },
      { name: 'Silver', investAmount: 500, dailyProfit: 55, validityDays: 30, category: 'Standard', popular: true },
      { name: 'Gold', investAmount: 1000, dailyProfit: 120, validityDays: 30, category: 'Premium', recommended: true, featured: true },
      { name: 'Platinum', investAmount: 5000, dailyProfit: 650, validityDays: 30, category: 'Premium', featured: true },
    ]
    await plansCol.insertMany(starters.map((p, i) => ({
      id: uuidv4(), ...p,
      totalProfit: p.dailyProfit * p.validityDays, image: imgs[i],
      status: 'active', enabled: true, sortOrder: i,
      featured: !!p.featured, popular: !!p.popular, recommended: !!p.recommended,
      createdAt: new Date(),
    })))
  }
}

async function logTx(db, userId, type, amount, meta = {}, wallet = 'main') {
  await db.collection('transactions').insertOne({
    id: uuidv4(), userId, type, amount, wallet, meta, createdAt: new Date(),
  })
}
async function incWallet(db, userId, wallet, amount) {
  await db.collection('users').updateOne({ id: userId }, { $inc: { [`wallets.${wallet}`]: amount } })
}

async function distributeReferral(db, fromUserId, baseAmount) {
  const settings = await db.collection('settings').findOne({ id: 'global' })
  if (!settings?.referral?.enabled) return
  const levels = settings.referral.levels || [10, 5, 2]
  const maxLevels = Math.min(settings.referral.maxLevels || levels.length, levels.length)
  let cur = await db.collection('users').findOne({ id: fromUserId })
  for (let i = 0; i < maxLevels; i++) {
    if (!cur?.referredBy) break
    const upline = await db.collection('users').findOne({ id: cur.referredBy })
    if (!upline) break
    const pct = levels[i]
    const commission = +(baseAmount * (pct / 100)).toFixed(2)
    if (commission > 0) {
      await db.collection('users').updateOne({ id: upline.id }, {
        $inc: { 'wallets.referral': commission, referralIncome: commission, todayIncome: commission }
      })
      await logTx(db, upline.id, 'referral', commission, { level: i + 1, fromUser: fromUserId }, 'referral')
    }
    cur = upline
  }
}

// auto-expire orders + handle missed collections (idempotent)
async function autoExpireOrders(db) {
  const now = new Date()
  await db.collection('orders').updateMany(
    { status: 'active', $expr: { $gte: ['$collectedDays', '$planSnapshot.validityDays'] } },
    { $set: { status: 'completed' } }
  )
  // Mark missed if expired without full collection
  await db.collection('orders').updateMany(
    { status: 'active', expiryAt: { $lt: now } },
    { $set: { status: 'expired' } }
  )
}

// ---------- Router ----------
async function handle(request, ctx) {
  const db = await getDb(); await seed(db); await autoExpireOrders(db)
  const params = await ctx.params
  const path = (params?.path || []).join('/')
  const method = request.method
  const seg = params?.path || []

  // ============ AUTH ============
  if (path === 'auth/signup' && method === 'POST') {
    const settings = await db.collection('settings').findOne({ id: 'global' })
    if (!settings?.registrationEnabled) return err('Registration disabled')
    const b = await request.json()
    const { email, password, name, phone, referralCode } = b
    if (!email || !password) return err('Email & password required')
    const exists = await db.collection('users').findOne({ email: email.toLowerCase() })
    if (exists) return err('Email already registered')
    let referredBy = null
    if (referralCode) {
      const ref = await db.collection('users').findOne({ referralCode: referralCode.toUpperCase() })
      if (ref) referredBy = ref.id
    }
    const hash = await bcrypt.hash(password, 8)
    const signupBonus = +(settings.referral?.signupBonus || 0)
    const user = {
      id: uuidv4(), email: email.toLowerCase(), password: hash, name: name || email.split('@')[0],
      phone: phone || '', role: 'user',
      wallets: { main: 0, profit: 0, referral: 0, bonus: signupBonus },
      todayIncome: 0, todayIncomeDate: '',
      rechargeTotal: 0, withdrawTotal: 0, investmentTotal: 0, totalProfit: 0, referralIncome: 0,
      referralCode: shortCode(8), referredBy, blocked: false, createdAt: new Date(),
    }
    await db.collection('users').insertOne(user)
    if (signupBonus > 0) await logTx(db, user.id, 'bonus', signupBonus, { reason: 'signup' }, 'bonus')
    await db.collection('loginLogs').insertOne({ id: uuidv4(), userId: user.id, ip: clientIP(request), ua: request.headers.get('user-agent') || '', event: 'signup', at: new Date() })
    const token = signToken(user)
    const { password: _p, ...safe } = user
    return J({ token, user: safe })
  }
  if (path === 'auth/login' && method === 'POST') {
    const { email, password } = await request.json()
    const user = await db.collection('users').findOne({ email: (email || '').toLowerCase() })
    if (!user) return err('Invalid credentials', 401)
    const ok = await bcrypt.compare(password || '', user.password)
    if (!ok) return err('Invalid credentials', 401)
    if (user.blocked) return err('Account suspended', 403)
    ensureWallets(user)
    if (!user.wallets.main) await db.collection('users').updateOne({ id: user.id }, { $set: { wallets: user.wallets } })
    await db.collection('loginLogs').insertOne({ id: uuidv4(), userId: user.id, ip: clientIP(request), ua: request.headers.get('user-agent') || '', event: 'login', at: new Date() })
    const token = signToken(user)
    const { password: _p, _id, ...safe } = user
    return J({ token, user: safe })
  }
  if (path === 'auth/send-otp' && method === 'POST') { return J({ ok: true, placeholder: true }) }
  if (path === 'auth/verify-otp' && method === 'POST') { return J({ ok: true, placeholder: true }) }

  // ============ ME ============
  if (path === 'me' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const today = new Date().toISOString().slice(0, 10)
    if (r.user.todayIncomeDate !== today) {
      await db.collection('users').updateOne({ id: r.user.id }, { $set: { todayIncome: 0, todayIncomeDate: today } })
      r.user.todayIncome = 0; r.user.todayIncomeDate = today
    }
    const { password, ...safe } = r.user
    safe.totalBalance = totalBalance(safe.wallets)
    // Live counts
    const [activePlans, completedPlans, pendingRecharges, pendingWithdrawals] = await Promise.all([
      db.collection('orders').countDocuments({ userId: r.user.id, status: 'active' }),
      db.collection('orders').countDocuments({ userId: r.user.id, status: { $in: ['completed', 'expired'] } }),
      db.collection('recharges').countDocuments({ userId: r.user.id, status: 'pending' }),
      db.collection('withdraws').countDocuments({ userId: r.user.id, status: 'pending' }),
    ])
    safe.stats = { activePlans, completedPlans, pendingRecharges, pendingWithdrawals }
    return J({ user: safe })
  }
  if (path === 'me' && method === 'PATCH') {
    const r = await requireUser(request); if (r.error) return r.error
    const b = await request.json(); const upd = {}
    for (const k of ['name', 'phone', 'bankDetails']) if (b[k] !== undefined) upd[k] = b[k]
    if (b.newPassword && b.oldPassword) {
      const ok = await bcrypt.compare(b.oldPassword, r.user.password)
      if (!ok) return err('Old password incorrect')
      upd.password = await bcrypt.hash(b.newPassword, 8)
    }
    await db.collection('users').updateOne({ id: r.user.id }, { $set: upd })
    return J({ ok: true })
  }

  // ============ SETTINGS (public partial) ============
  if (path === 'settings' && method === 'GET') {
    const s = await db.collection('settings').findOne({ id: 'global' }, { projection: { _id: 0 } })
    return J({ settings: s })
  }
  if (path === 'settings' && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    await db.collection('settings').updateOne({ id: 'global' }, { $set: b })
    return J({ ok: true })
  }

  // ============ PLANS ============
  if (path === 'plans' && method === 'GET') {
    const url = new URL(request.url)
    const cat = url.searchParams.get('category')
    const q = url.searchParams.get('q')
    const filter = {}
    if (cat) filter.category = cat
    if (q) filter.name = { $regex: q, $options: 'i' }
    const plans = await db.collection('plans').find(filter, { projection: { _id: 0 } }).sort({ sortOrder: 1, investAmount: 1 }).toArray()
    return J({ plans })
  }
  if (path === 'plans' && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    const plan = {
      id: uuidv4(), name: b.name, image: b.image || 'https://images.unsplash.com/photo-1596518433611-6f099bf4be3c?w=800&q=80',
      investAmount: +b.investAmount, dailyProfit: +b.dailyProfit, validityDays: +b.validityDays,
      totalProfit: +b.dailyProfit * +b.validityDays, status: b.status || 'active', enabled: b.enabled !== false,
      category: b.category || 'Basic', featured: !!b.featured, popular: !!b.popular, recommended: !!b.recommended,
      sortOrder: +b.sortOrder || 0, createdAt: new Date(),
    }
    await db.collection('plans').insertOne(plan); delete plan._id
    return J({ plan })
  }
  if (seg[0] === 'plans' && seg[1] === 'duplicate' && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    const orig = await db.collection('plans').findOne({ id: b.id }, { projection: { _id: 0 } })
    if (!orig) return err('Not found', 404)
    const dup = { ...orig, id: uuidv4(), name: orig.name + ' (Copy)', createdAt: new Date() }
    await db.collection('plans').insertOne(dup); delete dup._id
    return J({ plan: dup })
  }
  if (seg[0] === 'plans' && seg[1] && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json(); const upd = {}
    for (const k of ['name', 'image', 'status', 'category']) if (b[k] !== undefined) upd[k] = b[k]
    for (const k of ['featured', 'popular', 'recommended', 'enabled']) if (b[k] !== undefined) upd[k] = !!b[k]
    for (const k of ['investAmount', 'dailyProfit', 'validityDays', 'sortOrder']) if (b[k] !== undefined) upd[k] = +b[k]
    if (upd.dailyProfit !== undefined || upd.validityDays !== undefined) {
      const cur = await db.collection('plans').findOne({ id: seg[1] })
      upd.totalProfit = (upd.dailyProfit ?? cur.dailyProfit) * (upd.validityDays ?? cur.validityDays)
    }
    await db.collection('plans').updateOne({ id: seg[1] }, { $set: upd })
    return J({ ok: true })
  }
  if (seg[0] === 'plans' && seg[1] && method === 'DELETE') {
    const r = await requireAdmin(request); if (r.error) return r.error
    await db.collection('plans').deleteOne({ id: seg[1] })
    return J({ ok: true })
  }

  // ============ ORDERS ============
  if (path === 'orders' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const settings = await db.collection('settings').findOne({ id: 'global' })
    const { planId } = await request.json()
    const plan = await db.collection('plans').findOne({ id: planId })
    if (!plan || plan.status !== 'active' || plan.enabled === false) return err('Plan unavailable')
    const w = r.user.wallets || { main: 0, profit: 0, referral: 0, bonus: 0 }
    const total = (w.main || 0) + (w.profit || 0) + (w.referral || 0) + (w.bonus || 0)
    if (total < plan.investAmount) return err(`Insufficient balance. You have ${settings.currency.symbol}${total.toFixed(2)} across all wallets. Please recharge.`)
    // Deduct in order: main → bonus → profit → referral
    let remaining = plan.investAmount
    const deductions = {}
    for (const key of ['main', 'bonus', 'profit', 'referral']) {
      if (remaining <= 0) break
      const avail = w[key] || 0
      if (avail <= 0) continue
      const take = Math.min(avail, remaining)
      deductions[`wallets.${key}`] = -take
      remaining = +(remaining - take).toFixed(2)
    }
    const now = new Date()
    const interval = (settings.collectionIntervalHours || 24) * 3600 * 1000
    const order = {
      id: uuidv4(), userId: r.user.id, planId,
      planSnapshot: { name: plan.name, image: plan.image, investAmount: plan.investAmount, dailyProfit: plan.dailyProfit, validityDays: plan.validityDays, totalProfit: plan.totalProfit, category: plan.category },
      purchaseAt: now,
      expiryAt: new Date(now.getTime() + plan.validityDays * 86400000),
      nextCollectAt: new Date(now.getTime() + interval),
      intervalMs: interval,
      collectedDays: 0, totalEarned: 0, missedCollections: 0, status: 'active',
    }
    await db.collection('orders').insertOne(order)
    await db.collection('users').updateOne({ id: r.user.id }, { $inc: { ...deductions, investmentTotal: plan.investAmount } })
    await logTx(db, r.user.id, 'investment', -plan.investAmount, { planId, orderId: order.id, planName: plan.name, deductions }, 'main')
    delete order._id
    return J({ order })
  }
  if (path === 'orders' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const orders = await db.collection('orders').find({ userId: r.user.id }, { projection: { _id: 0 } }).sort({ purchaseAt: -1 }).toArray()
    return J({ orders })
  }
  if (seg[0] === 'orders' && seg[2] === 'collect' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const settings = await db.collection('settings').findOne({ id: 'global' })
    if (!settings?.collectEnabled) return err('Collection paused by admin')
    const order = await db.collection('orders').findOne({ id: seg[1], userId: r.user.id })
    if (!order) return err('Order not found', 404)
    if (order.status !== 'active') return err('Order not active')
    const now = new Date()
    if (new Date(order.nextCollectAt) > now) return err('Not ready yet')
    const profit = order.planSnapshot.dailyProfit
    const newCollected = order.collectedDays + 1
    const completed = newCollected >= order.planSnapshot.validityDays
    const interval = order.intervalMs || (settings.collectionIntervalHours || 24) * 3600000
    await db.collection('orders').updateOne({ id: order.id }, {
      $set: {
        collectedDays: newCollected,
        totalEarned: +(order.totalEarned + profit).toFixed(2),
        nextCollectAt: new Date(now.getTime() + interval),
        status: completed ? 'completed' : 'active',
        lastCollectAt: now,
      }
    })
    const today = new Date().toISOString().slice(0, 10)
    const incReset = r.user.todayIncomeDate !== today
    await db.collection('users').updateOne({ id: r.user.id }, { $inc: { 'wallets.profit': profit, totalProfit: profit } })
    if (incReset) await db.collection('users').updateOne({ id: r.user.id }, { $set: { todayIncomeDate: today, todayIncome: profit } })
    else await db.collection('users').updateOne({ id: r.user.id }, { $inc: { todayIncome: profit } })
    await logTx(db, r.user.id, 'daily_profit', profit, { orderId: order.id, plan: order.planSnapshot.name, day: newCollected }, 'profit')
    await distributeReferral(db, r.user.id, profit)
    return J({ ok: true, profit, completed })
  }

  // ============ WALLET TRANSFER (admin or user own) ============
  if (path === 'wallet/transfer' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const { from, to, amount } = await request.json()
    const allowed = ['main', 'profit', 'referral', 'bonus']
    if (!allowed.includes(from) || !allowed.includes(to) || from === to) return err('Invalid wallets')
    const amt = +amount
    if (!(amt > 0)) return err('Invalid amount')
    if ((r.user.wallets[from] || 0) < amt) return err('Insufficient balance in source wallet')
    await db.collection('users').updateOne({ id: r.user.id }, { $inc: { [`wallets.${from}`]: -amt, [`wallets.${to}`]: amt } })
    await logTx(db, r.user.id, 'transfer', amt, { from, to }, from)
    return J({ ok: true })
  }

  // ============ RECHARGE ============
  if (path === 'recharges' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const s = await db.collection('settings').findOne({ id: 'global' })
    if (!s.rechargeEnabled) return err('Recharge disabled')
    const { amount, txId, screenshot, method: pmId } = await request.json()
    const a = +amount
    if (!(a > 0)) return err('Invalid amount')
    if (a < s.minRecharge) return err(`Min recharge ${s.currency.symbol}${s.minRecharge}`)
    if (a > s.maxRecharge) return err(`Max recharge ${s.currency.symbol}${s.maxRecharge}`)
    const rec = { id: uuidv4(), userId: r.user.id, amount: a, txId: txId || '', screenshot: screenshot || '', methodId: pmId || '', status: 'pending', createdAt: new Date() }
    if (s.autoApproveRecharge) {
      rec.status = 'approved'; rec.processedAt = new Date()
      await db.collection('users').updateOne({ id: r.user.id }, { $inc: { 'wallets.main': a, rechargeTotal: a } })
      await logTx(db, r.user.id, 'recharge', a, { auto: true }, 'main')
    }
    await db.collection('recharges').insertOne(rec); delete rec._id
    return J({ recharge: rec })
  }
  if (path === 'recharges' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const q = r.user.role === 'admin' ? {} : { userId: r.user.id }
    const items = await db.collection('recharges').find(q, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    return J({ items })
  }
  if (seg[0] === 'recharges' && seg[1] && seg[2] && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const rec = await db.collection('recharges').findOne({ id: seg[1] })
    if (!rec || rec.status !== 'pending') return err('Invalid state')
    if (seg[2] === 'approve') {
      await db.collection('recharges').updateOne({ id: rec.id }, { $set: { status: 'approved', processedAt: new Date() } })
      await db.collection('users').updateOne({ id: rec.userId }, { $inc: { 'wallets.main': rec.amount, rechargeTotal: rec.amount } })
      await logTx(db, rec.userId, 'recharge', rec.amount, { rechargeId: rec.id }, 'main')
    } else if (seg[2] === 'reject') {
      await db.collection('recharges').updateOne({ id: rec.id }, { $set: { status: 'rejected', processedAt: new Date() } })
    }
    return J({ ok: true })
  }

  // ============ WITHDRAW ============
  if (path === 'withdraws' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const s = await db.collection('settings').findOne({ id: 'global' })
    if (!s.withdrawEnabled) return err('Withdraw disabled')
    const { amount, method: pm, details } = await request.json()
    const a = +amount
    if (!(a >= s.minWithdraw)) return err(`Min withdraw ${s.currency.symbol}${s.minWithdraw}`)
    if (a > s.maxWithdraw) return err(`Max withdraw ${s.currency.symbol}${s.maxWithdraw}`)
    // daily limit
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayAgg = await db.collection('withdraws').aggregate([{ $match: { userId: r.user.id, createdAt: { $gte: today }, status: { $in: ['pending', 'approved'] } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const todaySum = todayAgg[0]?.sum || 0
    if (todaySum + a > s.dailyWithdrawLimit) return err(`Daily withdraw limit ${s.currency.symbol}${s.dailyWithdrawLimit} exceeded`)
    if ((r.user.wallets.main || 0) < a) return err('Insufficient Main Wallet')
    const fee = +(a * (s.withdrawFeePct || 0) / 100).toFixed(2)
    const net = +(a - fee).toFixed(2)
    const w = { id: uuidv4(), userId: r.user.id, amount: a, fee, net, method: pm || 'UPI', details: details || '', status: 'pending', processingTimeHours: s.processingTimeHours, createdAt: new Date() }
    await db.collection('withdraws').insertOne(w)
    await db.collection('users').updateOne({ id: r.user.id }, { $inc: { 'wallets.main': -a } })
    delete w._id
    return J({ withdraw: w })
  }
  if (path === 'withdraws' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const q = r.user.role === 'admin' ? {} : { userId: r.user.id }
    const items = await db.collection('withdraws').find(q, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    return J({ items })
  }
  if (seg[0] === 'withdraws' && seg[1] && seg[2] && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const w = await db.collection('withdraws').findOne({ id: seg[1] })
    if (!w || w.status !== 'pending') return err('Invalid state')
    if (seg[2] === 'approve') {
      await db.collection('withdraws').updateOne({ id: w.id }, { $set: { status: 'approved', processedAt: new Date() } })
      await db.collection('users').updateOne({ id: w.userId }, { $inc: { withdrawTotal: w.amount } })
      await logTx(db, w.userId, 'withdraw', -w.amount, { withdrawId: w.id, fee: w.fee }, 'main')
    } else if (seg[2] === 'reject') {
      await db.collection('withdraws').updateOne({ id: w.id }, { $set: { status: 'rejected', processedAt: new Date() } })
      await db.collection('users').updateOne({ id: w.userId }, { $inc: { 'wallets.main': w.amount } })
    }
    return J({ ok: true })
  }

  // ============ TEAM / LEADERBOARD / TREE ============
  if (path === 'team' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const s = await db.collection('settings').findOne({ id: 'global' })
    const maxL = Math.min(s.referral.maxLevels || s.referral.levels.length, s.referral.levels.length)
    const tree = []
    let parents = [r.user.id]
    for (let i = 0; i < maxL; i++) {
      const lvl = await db.collection('users').find({ referredBy: { $in: parents } }, { projection: { _id: 0, password: 0 } }).toArray()
      // Enrich each member with active plans + commission generated
      const enriched = await Promise.all(lvl.map(async (u) => {
        const activePlans = await db.collection('orders').countDocuments({ userId: u.id, status: 'active' })
        const commAgg = await db.collection('transactions').aggregate([
          { $match: { userId: r.user.id, type: 'referral', 'meta.fromUser': u.id } },
          { $group: { _id: null, sum: { $sum: '$amount' } } }
        ]).toArray()
        return {
          id: u.id, name: u.name, email: u.email, createdAt: u.createdAt,
          investmentTotal: u.investmentTotal || 0,
          activePlans,
          commissionGenerated: commAgg[0]?.sum || 0,
          status: u.blocked ? 'blocked' : (activePlans > 0 ? 'active' : 'inactive'),
        }
      }))
      tree.push(enriched)
      parents = lvl.map(u => u.id)
      if (!parents.length) break
    }
    const refTxs = await db.collection('transactions').find({ userId: r.user.id, type: 'referral' }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(50).toArray()
    const totalMembers = tree.reduce((a, l) => a + l.length, 0)
    const totalTeamInvestment = tree.reduce((a, l) => a + l.reduce((aa, u) => aa + (u.investmentTotal || 0), 0), 0)
    return J({
      referralCode: r.user.referralCode,
      referralLink: `${process.env.NEXT_PUBLIC_BASE_URL || ''}?ref=${r.user.referralCode}`,
      settings: { levels: s.referral.levels, maxLevels: maxL, enabled: s.referral.enabled },
      tree,
      totals: tree.map(l => l.length),
      totalMembers,
      totalTeamInvestment,
      commissions: refTxs,
      referralIncome: r.user.referralIncome,
    })
  }
  if (path === 'leaderboard' && method === 'GET') {
    const top = await db.collection('users').find({ role: 'user' }, { projection: { _id: 0, password: 0, email: 0, phone: 0, bankDetails: 0 } }).sort({ referralIncome: -1 }).limit(20).toArray()
    const topInvestors = await db.collection('users').find({ role: 'user' }, { projection: { _id: 0, name: 1, investmentTotal: 1, totalProfit: 1, referralCode: 1 } }).sort({ investmentTotal: -1 }).limit(10).toArray()
    return J({ topReferrers: top, topInvestors })
  }

  // ============ GIFT CODES ============
  if (path === 'gifts' && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    const giftType = b.type || 'flat' // flat | percent | wallet
    const wallet = b.wallet || 'main'
    const usageLimit = +b.usageLimit || 1
    const count = Math.max(1, +b.count || 1)
    const created = []
    for (let i = 0; i < count; i++) {
      const g = {
        id: uuidv4(), code: count === 1 && b.code ? b.code.toUpperCase() : shortCode(10),
        type: giftType, wallet, reward: +b.reward || 0,
        expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
        usageLimit, usedCount: 0, used: false, usedBy: [], disabled: false, createdAt: new Date(),
      }
      await db.collection('gifts').insertOne(g); delete g._id; created.push(g)
    }
    return J({ gifts: created })
  }
  if (path === 'gifts' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    if (r.user.role !== 'admin') return J({ items: [] })
    const items = await db.collection('gifts').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    return J({ items })
  }
  if (path === 'gifts/redeem' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const s = await db.collection('settings').findOne({ id: 'global' })
    if (!s.giftEnabled) return err('Gift redemption disabled')
    const { code } = await request.json()
    const g = await db.collection('gifts').findOne({ code: (code || '').toUpperCase() })
    if (!g) return err('Invalid code')
    if (g.disabled) return err('Code disabled')
    if (g.usedCount >= g.usageLimit) return err('Code limit reached')
    if ((g.usedBy || []).includes(r.user.id)) return err('Already redeemed by you')
    if (g.expiresAt && new Date(g.expiresAt) < new Date()) return err('Code expired')
    let reward = g.reward
    if (g.type === 'percent') {
      reward = +(r.user.wallets.main * (g.reward / 100)).toFixed(2)
    }
    const wallet = g.wallet || 'main'
    await db.collection('gifts').updateOne({ id: g.id }, { $inc: { usedCount: 1 }, $push: { usedBy: r.user.id }, $set: { used: (g.usedCount + 1) >= g.usageLimit } })
    await db.collection('users').updateOne({ id: r.user.id }, { $inc: { [`wallets.${wallet}`]: reward } })
    await logTx(db, r.user.id, 'gift', reward, { code: g.code, type: g.type }, wallet)
    return J({ ok: true, reward, wallet })
  }
  if (seg[0] === 'gifts' && seg[1] && method === 'DELETE') {
    const r = await requireAdmin(request); if (r.error) return r.error
    await db.collection('gifts').deleteOne({ id: seg[1] })
    return J({ ok: true })
  }
  if (seg[0] === 'gifts' && seg[1] && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    await db.collection('gifts').updateOne({ id: seg[1] }, { $set: { disabled: !!b.disabled } })
    return J({ ok: true })
  }

  // ============ HISTORY ============
  if (path === 'history' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const filter = { userId: r.user.id }
    if (type) filter.type = type
    const items = await db.collection('transactions').find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(300).toArray()
    return J({ items })
  }

  // ============ ANNOUNCEMENTS (admin add/del; settings has list) ============
  if (path === 'announcements' && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    const a = { id: uuidv4(), title: b.title, message: b.message, createdAt: new Date() }
    await db.collection('settings').updateOne({ id: 'global' }, { $push: { announcements: { $each: [a], $position: 0 } } })
    return J({ ok: true })
  }
  if (seg[0] === 'announcements' && seg[1] && method === 'DELETE') {
    const r = await requireAdmin(request); if (r.error) return r.error
    await db.collection('settings').updateOne({ id: 'global' }, { $pull: { announcements: { id: seg[1] } } })
    return J({ ok: true })
  }

  // ============ TICKETS ============
  if (path === 'tickets' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const b = await request.json()
    const t = {
      id: uuidv4(),
      ticketNo: 'TKT-' + Date.now().toString(36).toUpperCase(),
      userId: r.user.id, userName: r.user.name,
      category: b.category || 'Other Query',
      subject: b.subject || 'Support Request',
      screenshot: b.screenshot || '',
      userInfo: { name: r.user.name, email: r.user.email, phone: r.user.phone, registeredAt: r.user.createdAt, userId: r.user.id, referralCode: r.user.referralCode },
      status: 'pending',
      messages: [{ from: 'user', text: b.message || '', screenshot: b.screenshot || '', at: new Date() }],
      createdAt: new Date(), updatedAt: new Date(),
    }
    await db.collection('tickets').insertOne(t); delete t._id
    return J({ ticket: t })
  }
  if (path === 'tickets' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const url = new URL(request.url)
    const cat = url.searchParams.get('category')
    const st = url.searchParams.get('status')
    const q = url.searchParams.get('q')
    const filter = r.user.role === 'admin' ? {} : { userId: r.user.id }
    if (cat) filter.category = cat
    if (st) filter.status = st
    if (q && r.user.role === 'admin') {
      filter.$or = [
        { 'userInfo.userId': { $regex: q, $options: 'i' } },
        { 'userInfo.name': { $regex: q, $options: 'i' } },
        { 'userInfo.email': { $regex: q, $options: 'i' } },
        { ticketNo: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
      ]
    }
    const items = await db.collection('tickets').find(filter, { projection: { _id: 0 } }).sort({ updatedAt: -1, createdAt: -1 }).toArray()
    return J({ items })
  }
  if (seg[0] === 'tickets' && seg[1] && seg[2] === 'status' && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const { status } = await request.json()
    if (!['pending', 'in_progress', 'resolved', 'closed', 'open'].includes(status)) return err('Invalid status')
    await db.collection('tickets').updateOne({ id: seg[1] }, { $set: { status, updatedAt: new Date() } })
    return J({ ok: true })
  }
  if (seg[0] === 'tickets' && seg[1] && seg[2] === 'reply' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const b = await request.json()
    const t = await db.collection('tickets').findOne({ id: seg[1] })
    if (!t) return err('Not found', 404)
    if (r.user.role !== 'admin' && t.userId !== r.user.id) return err('Forbidden', 403)
    const msg = { from: r.user.role === 'admin' ? 'admin' : 'user', text: b.message, screenshot: b.screenshot || '', at: new Date() }
    const upd = { $push: { messages: msg }, $set: { updatedAt: new Date() } }
    if (b.status) upd.$set.status = b.status
    // When user replies on resolved/closed, reopen as in_progress
    else if (r.user.role === 'user' && ['resolved', 'closed'].includes(t.status)) upd.$set.status = 'in_progress'
    // First admin reply moves pending → in_progress
    else if (r.user.role === 'admin' && t.status === 'pending') upd.$set.status = 'in_progress'
    await db.collection('tickets').updateOne({ id: t.id }, upd)
    return J({ ok: true })
  }

  // ============ ADMIN ============
  if (path === 'admin/stats' && method === 'GET') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const users = await db.collection('users').countDocuments({})
    const active = await db.collection('users').countDocuments({ blocked: false })
    const blocked = await db.collection('users').countDocuments({ blocked: true })
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayReg = await db.collection('users').countDocuments({ createdAt: { $gte: today } })
    const sum = async (c, m) => (await db.collection(c).aggregate([{ $match: m }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray())[0]?.sum || 0
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
      const nd = new Date(d); nd.setDate(d.getDate() + 1)
      days.push({
        day: d.toISOString().slice(5, 10),
        deposits: await sum('recharges', { status: 'approved', createdAt: { $gte: d, $lt: nd } }),
        withdrawals: await sum('withdraws', { status: 'approved', createdAt: { $gte: d, $lt: nd } }),
        profit: await sum('transactions', { type: 'daily_profit', createdAt: { $gte: d, $lt: nd } }),
        signups: await db.collection('users').countDocuments({ createdAt: { $gte: d, $lt: nd } }),
      })
    }
    const topPlansAgg = await db.collection('orders').aggregate([{ $group: { _id: '$planSnapshot.name', count: { $sum: 1 }, total: { $sum: '$planSnapshot.investAmount' } } }, { $sort: { total: -1 } }, { $limit: 5 }]).toArray()
    const topUsers = await db.collection('users').find({ role: 'user' }, { projection: { _id: 0, name: 1, investmentTotal: 1, totalProfit: 1 } }).sort({ investmentTotal: -1 }).limit(5).toArray()
    const topRef = await db.collection('users').find({ role: 'user' }, { projection: { _id: 0, name: 1, referralIncome: 1 } }).sort({ referralIncome: -1 }).limit(5).toArray()
    const latestActivity = await db.collection('transactions').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(10).toArray()
    return J({
      users, active, blocked, todayReg,
      todayDeposits: await sum('recharges', { status: 'approved', createdAt: { $gte: today } }),
      todayWithdrawals: await sum('withdraws', { status: 'approved', createdAt: { $gte: today } }),
      todayProfit: await sum('transactions', { type: 'daily_profit', createdAt: { $gte: today } }),
      totalInvestments: (await db.collection('orders').aggregate([{ $group: { _id: null, sum: { $sum: '$planSnapshot.investAmount' } } }]).toArray())[0]?.sum || 0,
      totalDeposits: await sum('recharges', { status: 'approved' }),
      totalWithdrawals: await sum('withdraws', { status: 'approved' }),
      revenueChart: days,
      topPlans: topPlansAgg, topUsers, topReferrers: topRef, latestActivity,
    })
  }
  if (path === 'admin/users' && method === 'GET') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const url = new URL(request.url)
    const q = url.searchParams.get('q')
    const filter = q ? { $or: [{ email: { $regex: q, $options: 'i' } }, { name: { $regex: q, $options: 'i' } }, { referralCode: { $regex: q, $options: 'i' } }] } : {}
    const users = await db.collection('users').find(filter, { projection: { _id: 0, password: 0 } }).sort({ createdAt: -1 }).limit(200).toArray()
    return J({ users })
  }
  if (seg[0] === 'admin' && seg[1] === 'users' && seg[2] && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json(); const upd = {}
    for (const k of ['name', 'phone', 'blocked', 'todayIncome', 'referralIncome']) if (b[k] !== undefined) upd[k] = b[k]
    if (b.wallets) upd.wallets = b.wallets
    if (b.resetPassword) upd.password = await bcrypt.hash(b.resetPassword, 8)
    await db.collection('users').updateOne({ id: seg[2] }, { $set: upd })
    return J({ ok: true })
  }
  if (seg[0] === 'admin' && seg[1] === 'users' && seg[2] && method === 'DELETE') {
    const r = await requireAdmin(request); if (r.error) return r.error
    await db.collection('users').deleteOne({ id: seg[2] })
    return J({ ok: true })
  }
  if (path === 'admin/login-logs' && method === 'GET') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const items = await db.collection('loginLogs').find({}, { projection: { _id: 0 } }).sort({ at: -1 }).limit(200).toArray()
    return J({ items })
  }
  if (seg[0] === 'admin' && seg[1] === 'orders' && method === 'GET') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const orders = await db.collection('orders').find({}, { projection: { _id: 0 } }).sort({ purchaseAt: -1 }).limit(200).toArray()
    return J({ orders })
  }
  if (seg[0] === 'admin' && seg[1] === 'orders' && seg[2] && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    await db.collection('orders').updateOne({ id: seg[2] }, { $set: b })
    return J({ ok: true })
  }
  if (seg[0] === 'admin' && seg[1] === 'wallet-transfer' && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const { userId, from, to, amount } = await request.json()
    const u = await db.collection('users').findOne({ id: userId })
    if (!u) return err('User not found', 404)
    ensureWallets(u)
    if ((u.wallets[from] || 0) < +amount) return err('Insufficient')
    await db.collection('users').updateOne({ id: userId }, { $inc: { [`wallets.${from}`]: -+amount, [`wallets.${to}`]: +amount } })
    return J({ ok: true })
  }

  // ============ HOME public ============
  if (path === 'home/stats' && method === 'GET') {
    const s = await db.collection('settings').findOne({ id: 'global' })
    const totalInvestors = await db.collection('users').countDocuments({ role: 'user' })
    const running = await db.collection('orders').countDocuments({ status: 'active' })
    const wdAgg = await db.collection('withdraws').aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const profitAgg = await db.collection('transactions').aggregate([{ $match: { type: 'daily_profit', createdAt: { $gte: today } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const latestDeps = await db.collection('recharges').find({ status: 'approved' }, { projection: { _id: 0, amount: 1, createdAt: 1, userId: 1 } }).sort({ createdAt: -1 }).limit(8).toArray()
    const latestWds = await db.collection('withdraws').find({ status: 'approved' }, { projection: { _id: 0, amount: 1, createdAt: 1, userId: 1 } }).sort({ createdAt: -1 }).limit(8).toArray()
    return J({
      totalInvestors: totalInvestors + 1284,
      runningInvestments: running + 412,
      totalWithdraw: (wdAgg[0]?.sum || 0) + 254000,
      todayProfit: (profitAgg[0]?.sum || 0) + 1200,
      latestDeposits: latestDeps, latestWithdrawals: latestWds,
      currency: s.currency, maintenance: s.maintenanceMode,
    })
  }

  return err('Not found: ' + path, 404)
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle
