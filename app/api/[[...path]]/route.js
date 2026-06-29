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
  if (!_client) {
    _client = new MongoClient(MONGO_URL)
    await _client.connect()
  }
  return _client.db(DB_NAME)
}

// ---------- Helpers ----------
const J = (data, status = 200) => NextResponse.json(data, { status })
const err = (msg, status = 400) => J({ error: msg }, status)

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
}
function getAuth(request) {
  const h = request.headers.get('authorization') || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}
async function requireUser(request) {
  const a = getAuth(request)
  if (!a) return { error: err('Unauthorized', 401) }
  const db = await getDb()
  const user = await db.collection('users').findOne({ id: a.id })
  if (!user) return { error: err('User not found', 401) }
  if (user.blocked) return { error: err('Account blocked', 403) }
  delete user._id
  return { user, db }
}
async function requireAdmin(request) {
  const r = await requireUser(request)
  if (r.error) return r
  if (r.user.role !== 'admin') return { error: err('Admin only', 403) }
  return r
}

function shortCode(len = 8) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)]
  return s
}

// ---------- Seed ----------
let _seeded = false
async function seed(db) {
  if (_seeded) return
  _seeded = true
  const usersCol = db.collection('users')
  const plansCol = db.collection('plans')
  const settingsCol = db.collection('settings')

  if (!(await settingsCol.findOne({ id: 'global' }))) {
    await settingsCol.insertOne({
      id: 'global',
      referral: { l1: 10, l2: 5, l3: 2 },
      referralEnabled: true,
      rechargeEnabled: true,
      withdrawEnabled: true,
      giftEnabled: true,
      collectEnabled: true,
      registrationEnabled: true,
      minWithdraw: 10,
      announcements: [
        { id: uuidv4(), title: 'Welcome to Investers Blueprint', message: 'Earn up to 300% returns. Refer & earn 10/5/2%.', createdAt: new Date() },
        { id: uuidv4(), title: 'Daily Profit Collection', message: 'Collect your daily profit every 24 hours.', createdAt: new Date() },
      ],
      about: '<h2>About Investers Blueprint</h2><p>Premium investment platform empowering wealth growth through smart, secure plans.</p>',
      faq: [
        { q: 'How do I start investing?', a: 'Sign up, recharge your wallet, and purchase any plan.' },
        { q: 'How is daily profit collected?', a: 'Open Orders and click Collect every 24 hours.' },
        { q: 'How do referrals work?', a: 'Share your referral link. You earn 10% / 5% / 2% on your levels 1, 2, 3 daily profit collections.' },
        { q: 'Minimum withdrawal?', a: 'Minimum withdrawal is $10. Admin approves manually.' },
      ],
    })
  }

  if (!(await usersCol.findOne({ email: 'admin@investers.io' }))) {
    const hash = await bcrypt.hash('admin123', 8)
    await usersCol.insertOne({
      id: uuidv4(), email: 'admin@investers.io', password: hash, name: 'Admin',
      phone: '', role: 'admin', walletBalance: 0, todayIncome: 0, todayIncomeDate: '',
      rechargeTotal: 0, withdrawTotal: 0, investmentTotal: 0, totalProfit: 0, referralIncome: 0,
      referralCode: 'ADMIN01', referredBy: null, blocked: false, createdAt: new Date(),
    })
  }
  if (!(await usersCol.findOne({ email: 'demo@investers.io' }))) {
    const hash = await bcrypt.hash('demo123', 8)
    await usersCol.insertOne({
      id: uuidv4(), email: 'demo@investers.io', password: hash, name: 'Demo User',
      phone: '', role: 'user', walletBalance: 500, todayIncome: 0, todayIncomeDate: '',
      rechargeTotal: 500, withdrawTotal: 0, investmentTotal: 0, totalProfit: 0, referralIncome: 0,
      referralCode: 'DEMO01', referredBy: null, blocked: false, createdAt: new Date(),
    })
  }

  if ((await plansCol.countDocuments()) === 0) {
    const imgs = [
      'https://images.unsplash.com/photo-1596518433611-6f099bf4be3c?w=800&q=80',
      'https://images.unsplash.com/photo-1629877522069-fe27cd719feb?w=800&q=80',
      'https://images.unsplash.com/photo-1643270869468-c1522976b91c?w=800&q=80',
      'https://images.unsplash.com/photo-1623773458482-0d47c9622ee7?w=800&q=80',
    ]
    const starters = [
      { name: 'Starter', investAmount: 100, dailyProfit: 10, validityDays: 30 },
      { name: 'Silver', investAmount: 500, dailyProfit: 55, validityDays: 30 },
      { name: 'Gold', investAmount: 1000, dailyProfit: 120, validityDays: 30 },
      { name: 'Platinum', investAmount: 5000, dailyProfit: 650, validityDays: 30 },
    ]
    await plansCol.insertMany(starters.map((p, i) => ({
      id: uuidv4(), ...p,
      totalProfit: p.dailyProfit * p.validityDays,
      image: imgs[i],
      status: 'active',
      createdAt: new Date(),
    })))
  }
}

// ---------- Domain ----------
async function logTx(db, userId, type, amount, meta = {}) {
  await db.collection('transactions').insertOne({
    id: uuidv4(), userId, type, amount, meta, createdAt: new Date()
  })
}

async function distributeReferral(db, fromUserId, baseAmount) {
  const settings = await db.collection('settings').findOne({ id: 'global' })
  if (!settings?.referralEnabled) return
  const pct = settings.referral || { l1: 10, l2: 5, l3: 2 }
  let currentUser = await db.collection('users').findOne({ id: fromUserId })
  const levels = ['l1', 'l2', 'l3']
  for (let i = 0; i < 3; i++) {
    if (!currentUser?.referredBy) break
    const upline = await db.collection('users').findOne({ id: currentUser.referredBy })
    if (!upline) break
    const commission = +(baseAmount * (pct[levels[i]] / 100)).toFixed(2)
    if (commission > 0) {
      await db.collection('users').updateOne(
        { id: upline.id },
        { $inc: { walletBalance: commission, referralIncome: commission, todayIncome: commission } }
      )
      await logTx(db, upline.id, 'referral', commission, { level: i + 1, fromUser: fromUserId })
    }
    currentUser = upline
  }
}

// ---------- Router ----------
async function handle(request, { params }) {
  const db = await getDb()
  await seed(db)

  const path = (params?.path || []).join('/')
  const method = request.method
  const seg = (params?.path || [])

  // ====== AUTH ======
  if (path === 'auth/signup' && method === 'POST') {
    const body = await request.json()
    const { email, password, name, phone, referralCode } = body
    if (!email || !password) return err('Email & password required')
    const exists = await db.collection('users').findOne({ email: email.toLowerCase() })
    if (exists) return err('Email already registered')
    let referredBy = null
    if (referralCode) {
      const ref = await db.collection('users').findOne({ referralCode: referralCode.toUpperCase() })
      if (ref) referredBy = ref.id
    }
    const hash = await bcrypt.hash(password, 8)
    const user = {
      id: uuidv4(), email: email.toLowerCase(), password: hash, name: name || email.split('@')[0],
      phone: phone || '', role: 'user',
      walletBalance: 0, todayIncome: 0, todayIncomeDate: '',
      rechargeTotal: 0, withdrawTotal: 0, investmentTotal: 0, totalProfit: 0, referralIncome: 0,
      referralCode: shortCode(8), referredBy, blocked: false, createdAt: new Date(),
    }
    await db.collection('users').insertOne(user)
    const token = signToken(user)
    const { password: _p, _id, ...safe } = user
    return J({ token, user: safe })
  }

  if (path === 'auth/login' && method === 'POST') {
    const { email, password } = await request.json()
    const user = await db.collection('users').findOne({ email: (email || '').toLowerCase() })
    if (!user) return err('Invalid credentials', 401)
    const ok = await bcrypt.compare(password || '', user.password)
    if (!ok) return err('Invalid credentials', 401)
    if (user.blocked) return err('Account is suspended', 403)
    const token = signToken(user)
    const { password: _p, _id, ...safe } = user
    return J({ token, user: safe })
  }

  // Placeholder OTP APIs (intentionally empty)
  if (path === 'auth/send-otp' && method === 'POST') {
    // sendOTP() — to be implemented by another developer
    return J({ ok: true, placeholder: true })
  }
  if (path === 'auth/verify-otp' && method === 'POST') {
    // verifyOTP() — to be implemented by another developer
    return J({ ok: true, placeholder: true })
  }

  // ====== ME ======
  if (path === 'me' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    // reset today's income if day changed
    const today = new Date().toISOString().slice(0, 10)
    if (r.user.todayIncomeDate !== today) {
      await db.collection('users').updateOne({ id: r.user.id }, { $set: { todayIncome: 0, todayIncomeDate: today } })
      r.user.todayIncome = 0
      r.user.todayIncomeDate = today
    }
    const { password, ...safe } = r.user
    return J({ user: safe })
  }

  if (path === 'me' && method === 'PATCH') {
    const r = await requireUser(request); if (r.error) return r.error
    const body = await request.json()
    const updates = {}
    for (const k of ['name', 'phone', 'bankDetails']) if (body[k] !== undefined) updates[k] = body[k]
    if (body.newPassword && body.oldPassword) {
      const ok = await bcrypt.compare(body.oldPassword, r.user.password)
      if (!ok) return err('Old password incorrect')
      updates.password = await bcrypt.hash(body.newPassword, 8)
    }
    await db.collection('users').updateOne({ id: r.user.id }, { $set: updates })
    return J({ ok: true })
  }

  // ====== PLANS ======
  if (path === 'plans' && method === 'GET') {
    const plans = await db.collection('plans').find({}, { projection: { _id: 0 } }).sort({ investAmount: 1 }).toArray()
    return J({ plans })
  }
  if (path === 'plans' && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    const plan = {
      id: uuidv4(),
      name: b.name, image: b.image || 'https://images.unsplash.com/photo-1596518433611-6f099bf4be3c?w=800&q=80',
      investAmount: +b.investAmount, dailyProfit: +b.dailyProfit, validityDays: +b.validityDays,
      totalProfit: +b.dailyProfit * +b.validityDays,
      status: b.status || 'active', createdAt: new Date(),
    }
    await db.collection('plans').insertOne(plan)
    delete plan._id
    return J({ plan })
  }
  if (seg[0] === 'plans' && seg[1] && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    const upd = {}
    for (const k of ['name', 'image', 'status']) if (b[k] !== undefined) upd[k] = b[k]
    for (const k of ['investAmount', 'dailyProfit', 'validityDays']) if (b[k] !== undefined) upd[k] = +b[k]
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

  // ====== ORDERS ======
  if (path === 'orders' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const { planId } = await request.json()
    const plan = await db.collection('plans').findOne({ id: planId })
    if (!plan || plan.status !== 'active') return err('Plan unavailable')
    if (r.user.walletBalance < plan.investAmount) return err('Insufficient balance. Please recharge.')
    const now = new Date()
    const expiryAt = new Date(now.getTime() + plan.validityDays * 86400000)
    const nextCollectAt = new Date(now.getTime() + 86400000)
    const order = {
      id: uuidv4(), userId: r.user.id, planId,
      planSnapshot: { name: plan.name, image: plan.image, investAmount: plan.investAmount, dailyProfit: plan.dailyProfit, validityDays: plan.validityDays, totalProfit: plan.totalProfit },
      purchaseAt: now, expiryAt, nextCollectAt,
      collectedDays: 0, totalEarned: 0, status: 'active',
    }
    await db.collection('orders').insertOne(order)
    await db.collection('users').updateOne({ id: r.user.id }, {
      $inc: { walletBalance: -plan.investAmount, investmentTotal: plan.investAmount }
    })
    await logTx(db, r.user.id, 'investment', -plan.investAmount, { planId, orderId: order.id, planName: plan.name })
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
    if (!settings?.collectEnabled) return err('Collection is temporarily disabled')
    const order = await db.collection('orders').findOne({ id: seg[1], userId: r.user.id })
    if (!order) return err('Order not found', 404)
    if (order.status !== 'active') return err('Order not active')
    const now = new Date()
    if (new Date(order.nextCollectAt) > now) return err('Not ready yet')
    const profit = order.planSnapshot.dailyProfit
    const newCollected = order.collectedDays + 1
    const completed = newCollected >= order.planSnapshot.validityDays
    await db.collection('orders').updateOne({ id: order.id }, {
      $set: {
        collectedDays: newCollected,
        totalEarned: +(order.totalEarned + profit).toFixed(2),
        nextCollectAt: new Date(now.getTime() + 86400000),
        status: completed ? 'completed' : 'active',
        lastCollectAt: now,
      }
    })
    // update user balances
    const today = new Date().toISOString().slice(0, 10)
    const incReset = r.user.todayIncomeDate !== today
    await db.collection('users').updateOne({ id: r.user.id }, {
      $inc: { walletBalance: profit, totalProfit: profit, todayIncome: incReset ? 0 : 0 },
    })
    // set today income carefully (reset if new day)
    if (incReset) {
      await db.collection('users').updateOne({ id: r.user.id }, { $set: { todayIncomeDate: today, todayIncome: profit } })
    } else {
      await db.collection('users').updateOne({ id: r.user.id }, { $inc: { todayIncome: profit } })
    }
    await logTx(db, r.user.id, 'daily_profit', profit, { orderId: order.id, plan: order.planSnapshot.name, day: newCollected })
    // referral payout
    await distributeReferral(db, r.user.id, profit)
    return J({ ok: true, profit, completed })
  }

  // ====== RECHARGE ======
  if (path === 'recharges' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const settings = await db.collection('settings').findOne({ id: 'global' })
    if (!settings?.rechargeEnabled) return err('Recharge disabled')
    const { amount, txId, screenshot } = await request.json()
    if (!amount || +amount <= 0) return err('Invalid amount')
    const rec = {
      id: uuidv4(), userId: r.user.id, amount: +amount, txId: txId || '',
      screenshot: screenshot || '', status: 'pending', createdAt: new Date(),
    }
    await db.collection('recharges').insertOne(rec)
    delete rec._id
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
    const action = seg[2] // approve | reject
    const rec = await db.collection('recharges').findOne({ id: seg[1] })
    if (!rec) return err('Not found', 404)
    if (rec.status !== 'pending') return err('Already processed')
    if (action === 'approve') {
      await db.collection('recharges').updateOne({ id: rec.id }, { $set: { status: 'approved', processedAt: new Date() } })
      await db.collection('users').updateOne({ id: rec.userId }, { $inc: { walletBalance: rec.amount, rechargeTotal: rec.amount } })
      await logTx(db, rec.userId, 'recharge', rec.amount, { rechargeId: rec.id })
    } else if (action === 'reject') {
      await db.collection('recharges').updateOne({ id: rec.id }, { $set: { status: 'rejected', processedAt: new Date() } })
    }
    return J({ ok: true })
  }

  // ====== WITHDRAW ======
  if (path === 'withdraws' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const settings = await db.collection('settings').findOne({ id: 'global' })
    if (!settings?.withdrawEnabled) return err('Withdraw disabled')
    const { amount, method: payMethod, details } = await request.json()
    if (!amount || +amount < settings.minWithdraw) return err(`Min withdraw is $${settings.minWithdraw}`)
    if (r.user.walletBalance < +amount) return err('Insufficient balance')
    const w = {
      id: uuidv4(), userId: r.user.id, amount: +amount,
      method: payMethod || 'UPI', details: details || '', status: 'pending', createdAt: new Date(),
    }
    await db.collection('withdraws').insertOne(w)
    // freeze balance
    await db.collection('users').updateOne({ id: r.user.id }, { $inc: { walletBalance: -+amount } })
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
    const action = seg[2]
    const w = await db.collection('withdraws').findOne({ id: seg[1] })
    if (!w) return err('Not found', 404)
    if (w.status !== 'pending') return err('Already processed')
    if (action === 'approve') {
      await db.collection('withdraws').updateOne({ id: w.id }, { $set: { status: 'approved', processedAt: new Date() } })
      await db.collection('users').updateOne({ id: w.userId }, { $inc: { withdrawTotal: w.amount } })
      await logTx(db, w.userId, 'withdraw', -w.amount, { withdrawId: w.id })
    } else if (action === 'reject') {
      await db.collection('withdraws').updateOne({ id: w.id }, { $set: { status: 'rejected', processedAt: new Date() } })
      // refund
      await db.collection('users').updateOne({ id: w.userId }, { $inc: { walletBalance: w.amount } })
    }
    return J({ ok: true })
  }

  // ====== TEAM ======
  if (path === 'team' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const settings = await db.collection('settings').findOne({ id: 'global' })
    const l1 = await db.collection('users').find({ referredBy: r.user.id }, { projection: { id: 1, name: 1, email: 1, createdAt: 1, _id: 0 } }).toArray()
    const l1ids = l1.map(u => u.id)
    const l2 = await db.collection('users').find({ referredBy: { $in: l1ids } }, { projection: { id: 1, name: 1, email: 1, createdAt: 1, _id: 0 } }).toArray()
    const l2ids = l2.map(u => u.id)
    const l3 = await db.collection('users').find({ referredBy: { $in: l2ids } }, { projection: { id: 1, name: 1, email: 1, createdAt: 1, _id: 0 } }).toArray()
    const refTxs = await db.collection('transactions').find({ userId: r.user.id, type: 'referral' }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(50).toArray()
    return J({
      referralCode: r.user.referralCode,
      referralLink: `${process.env.NEXT_PUBLIC_BASE_URL || ''}?ref=${r.user.referralCode}`,
      settings: { referral: settings.referral, referralEnabled: settings.referralEnabled },
      l1, l2, l3, totals: { l1: l1.length, l2: l2.length, l3: l3.length },
      commissions: refTxs,
      referralIncome: r.user.referralIncome,
    })
  }

  // ====== GIFT CODES ======
  if (path === 'gifts' && method === 'POST') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const { code, reward, expiresAt } = await request.json()
    const g = {
      id: uuidv4(), code: (code || shortCode(10)).toUpperCase(),
      reward: +reward || 0, expiresAt: expiresAt ? new Date(expiresAt) : null,
      used: false, usedBy: null, disabled: false, createdAt: new Date(),
    }
    await db.collection('gifts').insertOne(g)
    delete g._id
    return J({ gift: g })
  }
  if (path === 'gifts' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    if (r.user.role !== 'admin') return J({ items: [] })
    const items = await db.collection('gifts').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    return J({ items })
  }
  if (path === 'gifts/redeem' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const settings = await db.collection('settings').findOne({ id: 'global' })
    if (!settings?.giftEnabled) return err('Gift redemption disabled')
    const { code } = await request.json()
    const g = await db.collection('gifts').findOne({ code: (code || '').toUpperCase() })
    if (!g) return err('Invalid code')
    if (g.disabled) return err('Code disabled')
    if (g.used) return err('Code already used')
    if (g.expiresAt && new Date(g.expiresAt) < new Date()) return err('Code expired')
    await db.collection('gifts').updateOne({ id: g.id }, { $set: { used: true, usedBy: r.user.id, usedAt: new Date() } })
    await db.collection('users').updateOne({ id: r.user.id }, { $inc: { walletBalance: g.reward } })
    await logTx(db, r.user.id, 'gift', g.reward, { code: g.code })
    return J({ ok: true, reward: g.reward })
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

  // ====== HISTORY ======
  if (path === 'history' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const items = await db.collection('transactions').find({ userId: r.user.id }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(200).toArray()
    return J({ items })
  }

  // ====== SETTINGS / Announcements / FAQ ======
  if (path === 'settings' && method === 'GET') {
    const settings = await db.collection('settings').findOne({ id: 'global' }, { projection: { _id: 0 } })
    return J({ settings })
  }
  if (path === 'settings' && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    const upd = {}
    for (const k of ['referralEnabled', 'rechargeEnabled', 'withdrawEnabled', 'giftEnabled', 'collectEnabled', 'registrationEnabled']) {
      if (b[k] !== undefined) upd[k] = !!b[k]
    }
    if (b.minWithdraw !== undefined) upd.minWithdraw = +b.minWithdraw
    if (b.referral) upd.referral = { l1: +b.referral.l1, l2: +b.referral.l2, l3: +b.referral.l3 }
    if (b.about !== undefined) upd.about = String(b.about)
    if (b.faq !== undefined) upd.faq = b.faq
    await db.collection('settings').updateOne({ id: 'global' }, { $set: upd })
    return J({ ok: true })
  }
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

  // ====== TICKETS ======
  if (path === 'tickets' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const b = await request.json()
    const t = {
      id: uuidv4(), userId: r.user.id, subject: b.subject || 'Support',
      status: 'open', messages: [{ from: 'user', text: b.message, at: new Date() }],
      createdAt: new Date(),
    }
    await db.collection('tickets').insertOne(t)
    delete t._id
    return J({ ticket: t })
  }
  if (path === 'tickets' && method === 'GET') {
    const r = await requireUser(request); if (r.error) return r.error
    const q = r.user.role === 'admin' ? {} : { userId: r.user.id }
    const items = await db.collection('tickets').find(q, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    return J({ items })
  }
  if (seg[0] === 'tickets' && seg[1] && seg[2] === 'reply' && method === 'POST') {
    const r = await requireUser(request); if (r.error) return r.error
    const b = await request.json()
    const t = await db.collection('tickets').findOne({ id: seg[1] })
    if (!t) return err('Not found', 404)
    if (r.user.role !== 'admin' && t.userId !== r.user.id) return err('Forbidden', 403)
    const msg = { from: r.user.role === 'admin' ? 'admin' : 'user', text: b.message, at: new Date() }
    const upd = { $push: { messages: msg } }
    if (b.status) upd.$set = { status: b.status }
    await db.collection('tickets').updateOne({ id: t.id }, upd)
    return J({ ok: true })
  }

  // ====== ADMIN ======
  if (path === 'admin/stats' && method === 'GET') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const users = await db.collection('users').countDocuments({})
    const active = await db.collection('users').countDocuments({ blocked: false })
    const blocked = await db.collection('users').countDocuments({ blocked: true })
    const today = new Date(); today.setHours(0,0,0,0)
    const todayReg = await db.collection('users').countDocuments({ createdAt: { $gte: today } })
    const todayDepAgg = await db.collection('recharges').aggregate([{ $match: { status: 'approved', createdAt: { $gte: today } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const todayWdAgg = await db.collection('withdraws').aggregate([{ $match: { status: 'approved', createdAt: { $gte: today } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const totalInvAgg = await db.collection('orders').aggregate([{ $group: { _id: null, sum: { $sum: '$planSnapshot.investAmount' } } }]).toArray()
    const todayProfitAgg = await db.collection('transactions').aggregate([{ $match: { type: 'daily_profit', createdAt: { $gte: today } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const totalDepAgg = await db.collection('recharges').aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const totalWdAgg = await db.collection('withdraws').aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    // last 7 days revenue
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i)
      const nd = new Date(d); nd.setDate(d.getDate() + 1)
      const dep = await db.collection('recharges').aggregate([{ $match: { status: 'approved', createdAt: { $gte: d, $lt: nd } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
      const wd = await db.collection('withdraws').aggregate([{ $match: { status: 'approved', createdAt: { $gte: d, $lt: nd } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
      days.push({ day: d.toISOString().slice(5,10), deposits: dep[0]?.sum || 0, withdrawals: wd[0]?.sum || 0 })
    }
    return J({
      users, active, blocked, todayReg,
      todayDeposits: todayDepAgg[0]?.sum || 0,
      todayWithdrawals: todayWdAgg[0]?.sum || 0,
      todayProfit: todayProfitAgg[0]?.sum || 0,
      totalInvestments: totalInvAgg[0]?.sum || 0,
      totalDeposits: totalDepAgg[0]?.sum || 0,
      totalWithdrawals: totalWdAgg[0]?.sum || 0,
      revenueChart: days,
    })
  }
  if (path === 'admin/users' && method === 'GET') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const users = await db.collection('users').find({}, { projection: { _id: 0, password: 0 } }).sort({ createdAt: -1 }).limit(200).toArray()
    return J({ users })
  }
  if (seg[0] === 'admin' && seg[1] === 'users' && seg[2] && method === 'PATCH') {
    const r = await requireAdmin(request); if (r.error) return r.error
    const b = await request.json()
    const upd = {}
    for (const k of ['name', 'phone', 'blocked', 'walletBalance', 'todayIncome', 'referralIncome']) if (b[k] !== undefined) upd[k] = typeof b[k] === 'number' ? b[k] : b[k]
    if (b.resetPassword) upd.password = await bcrypt.hash(b.resetPassword, 8)
    await db.collection('users').updateOne({ id: seg[2] }, { $set: upd })
    return J({ ok: true })
  }
  if (seg[0] === 'admin' && seg[1] === 'users' && seg[2] && method === 'DELETE') {
    const r = await requireAdmin(request); if (r.error) return r.error
    await db.collection('users').deleteOne({ id: seg[2] })
    return J({ ok: true })
  }

  // ====== HOME public stats ======
  if (path === 'home/stats' && method === 'GET') {
    const totalInvestors = await db.collection('users').countDocuments({ role: 'user' })
    const running = await db.collection('orders').countDocuments({ status: 'active' })
    const wdAgg = await db.collection('withdraws').aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const today = new Date(); today.setHours(0,0,0,0)
    const profitAgg = await db.collection('transactions').aggregate([{ $match: { type: 'daily_profit', createdAt: { $gte: today } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }]).toArray()
    const latestDeps = await db.collection('recharges').find({ status: 'approved' }, { projection: { _id: 0, amount: 1, createdAt: 1, userId: 1 } }).sort({ createdAt: -1 }).limit(8).toArray()
    const latestWds = await db.collection('withdraws').find({ status: 'approved' }, { projection: { _id: 0, amount: 1, createdAt: 1, userId: 1 } }).sort({ createdAt: -1 }).limit(8).toArray()
    return J({
      totalInvestors: totalInvestors + 1284,    // boost cosmetic
      runningInvestments: running + 412,
      totalWithdraw: (wdAgg[0]?.sum || 0) + 254000,
      todayProfit: (profitAgg[0]?.sum || 0) + 1200,
      latestDeposits: latestDeps, latestWithdrawals: latestWds,
    })
  }

  return err('Not found: ' + path, 404)
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle
