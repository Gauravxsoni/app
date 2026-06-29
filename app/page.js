'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Home, Layers, Users, User, Wallet, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  Gift, History as HistoryIcon, ShoppingBag, Info, LifeBuoy, LogOut, Copy, Shield,
  ChevronRight, BadgeCheck, Sparkles, Bell, Zap, ChevronDown, X, Crown, Star,
  Building2, KeySquare, BarChart3, Settings, Power, Trash2, Plus, Search,
  ArrowLeftRight, Trophy, FileText, Image as ImageIcon, MessageSquare, Network,
  Award, Copy as CopyIc, Eye, EyeOff,
} from 'lucide-react'
import { ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

// ============ helpers ============
let CURRENCY = { code: 'USD', symbol: '$' }
const fmt = (n) => `${CURRENCY.symbol}${(+n || 0).toFixed(2)}`
const fmtN = (n) => (+n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

function api(path, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ib_token') : null
  return fetch('/api/' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  }).then(async r => {
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'Request failed')
    return d
  })
}

// Custom confirm dialog (replaces window.confirm which is blocked in iframes)
function askConfirm(message) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem'
    wrap.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(245,200,66,.10),rgba(30,58,138,.18));border:1px solid rgba(245,200,66,.30);backdrop-filter:blur(20px);border-radius:1.25rem;padding:1.5rem;max-width:24rem;width:100%;color:#fff;font-family:inherit">
        <div style="font-size:.95rem;margin-bottom:1rem;line-height:1.4">${message}</div>
        <div style="display:flex;gap:.5rem">
          <button id="ib_yes" style="flex:1;background:linear-gradient(135deg,#fbe089,#f5c842,#b8860b);color:#1a1a2e;font-weight:700;padding:.6rem;border-radius:.75rem;border:none;cursor:pointer">Confirm</button>
          <button id="ib_no" style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);color:#fff;padding:.6rem;border-radius:.75rem;cursor:pointer">Cancel</button>
        </div>
      </div>`
    document.body.appendChild(wrap)
    const cleanup = (v) => { document.body.removeChild(wrap); resolve(v) }
    wrap.querySelector('#ib_yes').onclick = () => cleanup(true)
    wrap.querySelector('#ib_no').onclick = () => cleanup(false)
    wrap.onclick = (e) => { if (e.target === wrap) cleanup(false) }
  })
}

// ============ reusable UI ============
const GlassCard = ({ className = '', children, ...p }) => (<div className={`glass rounded-2xl ${className}`} {...p}>{children}</div>)
const GoldButton = ({ className = '', children, ...p }) => (<button className={`gold-btn px-5 py-2.5 rounded-xl ${className}`} {...p}>{children}</button>)
const SoftButton = ({ className = '', children, ...p }) => (<button className={`px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition ${className}`} {...p}>{children}</button>)
const Input = ({ value, onChange, ...p }) => (<input {...p} value={value ?? ''} onChange={e => onChange(e.target.value)} className={`w-full bg-white/5 border border-white/10 focus:border-yellow-400/60 outline-none rounded-xl px-4 py-3 text-sm placeholder:text-white/40 ${p.className || ''}`} />)
const Textarea = ({ value, onChange, ...p }) => (<textarea {...p} value={value ?? ''} onChange={e => onChange(e.target.value)} className={`w-full bg-white/5 border border-white/10 focus:border-yellow-400/60 outline-none rounded-xl px-4 py-3 text-sm placeholder:text-white/40 ${p.className || ''}`} />)
const Select = ({ value, onChange, options, ...p }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm ${p.className || ''}`}>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>
)
const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between glass rounded-xl p-3 cursor-pointer">
    <span className="text-sm">{label}</span>
    <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} className="accent-yellow-400 w-5 h-5" />
  </label>
)
const Badge = ({ children, color = 'gold' }) => {
  const c = { gold: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30', blue: 'bg-blue-400/20 text-blue-300 border-blue-400/30', green: 'bg-green-400/20 text-green-300 border-green-400/30', red: 'bg-red-400/20 text-red-300 border-red-400/30', purple: 'bg-purple-400/20 text-purple-300 border-purple-400/30' }[color]
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${c}`}>{children}</span>
}
const StatusBadge = ({ s }) => <Badge color={{ pending: 'gold', approved: 'green', rejected: 'red', open: 'blue', closed: 'red', completed: 'blue', active: 'green', expired: 'red' }[s] || 'gold'}>{s}</Badge>
const StatCard = ({ icon: Icon, label, value, accent }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 sm:p-5 relative overflow-hidden">
    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-50" style={{ background: accent || '#f5c84244' }} />
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#fbe089,#b8860b)', color: '#1a1a2e' }}><Icon size={20} /></div>
      <div><div className="text-xs text-white/60">{label}</div><div className="text-lg sm:text-2xl font-bold gold-text">{value}</div></div>
    </div>
  </motion.div>
)

// ============ Auth ============
function AuthScreen({ onAuth, settings }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', referralCode: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  useEffect(() => {
    const ref = new URL(window.location.href).searchParams.get('ref')
    if (ref) { setForm(f => ({ ...f, referralCode: ref })); setMode('signup') }
    const e = localStorage.getItem('ib_saved_email')
    if (e) setForm(f => ({ ...f, email: e }))
  }, [])
  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const r = await api('auth/' + (mode === 'login' ? 'login' : 'signup'), { method: 'POST', body: form })
      localStorage.setItem('ib_token', r.token)
      if (remember) localStorage.setItem('ib_saved_email', form.email); else localStorage.removeItem('ib_saved_email')
      onAuth(r.user)
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen aurora flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-3"><Crown size={14} className="text-yellow-300" /><span className="text-xs">Premium Investment Platform</span></div>
          <h1 className="text-4xl font-extrabold tracking-tight"><span className="gold-text">{(settings?.siteName || 'Investers Blueprint').split(' ')[0]}</span> <span className="text-white">{(settings?.siteName || 'Investers Blueprint').split(' ').slice(1).join(' ')}</span></h1>
          <p className="text-white/60 text-sm mt-1">Build Your Wealth With Smart Investments</p>
        </div>
        <GlassCard className="p-6">
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            {['login', 'signup'].map(m => <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === m ? 'gold-btn !shadow-none' : 'text-white/70'}`}>{m === 'login' ? 'Login' : 'Sign Up'}</button>)}
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (<><Input placeholder="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} /><Input placeholder="Phone (optional)" value={form.phone} onChange={v => setForm({ ...form, phone: v })} /></>)}
            <Input placeholder="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} required />
            <div className="relative">
              <Input placeholder="Password" type={showPw ? 'text' : 'password'} value={form.password} onChange={v => setForm({ ...form, password: v })} required />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            {mode === 'signup' && <Input placeholder="Referral code (optional)" value={form.referralCode} onChange={v => setForm({ ...form, referralCode: v.toUpperCase() })} />}
            <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="accent-yellow-400" /> Remember me</label>
            <GoldButton disabled={loading} className="w-full !py-3">{loading ? 'Please wait…' : (mode === 'login' ? 'Login' : 'Create Account')}</GoldButton>
            <div className="text-xs text-white/50 text-center pt-2">Demo: <span className="text-yellow-300">demo@investers.io / demo123</span> · Admin: <span className="text-yellow-300">admin@investers.io / admin123</span></div>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  )
}

// ============ Header ============
function Header({ user, settings, onLogout, onSwitch, onNav }) {
  const balance = useMemo(() => (user.wallets?.main || 0) + (user.wallets?.profit || 0) + (user.wallets?.referral || 0) + (user.wallets?.bonus || 0), [user.wallets])
  return (
    <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#070b1a]/70 border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gold-btn !shadow-none flex items-center justify-center"><Crown size={18} /></div>
        <div className="leading-tight">
          <div className="font-bold text-sm sm:text-base"><span className="gold-text">{(settings?.siteName || 'Investers').split(' ')[0]}</span> {(settings?.siteName || 'Blueprint').split(' ').slice(1).join(' ')}</div>
          <div className="text-[10px] text-white/50 -mt-0.5">Build wealth, daily.</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10"><Wallet size={14} className="text-yellow-300" /><span className="text-xs text-white/70">Total</span><span className="text-sm font-semibold gold-text">{fmt(balance)}</span></div>
          {user.role === 'admin' && <button onClick={onSwitch} className="px-3 py-1.5 rounded-xl border border-yellow-400/40 text-yellow-300 text-xs flex items-center gap-1"><Shield size={14} /> Admin</button>}
          <button onClick={() => onNav('notifications')} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Bell size={16} /></button>
          <button onClick={onLogout} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><LogOut size={16} /></button>
        </div>
      </div>
    </div>
  )
}

// ============ Home ============
function HomePage({ settings, plans, onNav }) {
  const [stats, setStats] = useState(null)
  const [slide, setSlide] = useState(0)
  const [annI, setAnnI] = useState(0)
  const [popup, setPopup] = useState(false)
  const [disclaimer, setDisclaimer] = useState(false)
  useEffect(() => { api('home/stats').then(setStats) }, [])
  const slides = settings?.bannerSlides || []
  const annc = settings?.announcements || []
  useEffect(() => { if (slides.length < 2) return; const t = setInterval(() => setSlide(s => (s + 1) % slides.length), 5000); return () => clearInterval(t) }, [slides.length])
  useEffect(() => { if (annc.length < 2) return; const t = setInterval(() => setAnnI(i => (i + 1) % annc.length), 4000); return () => clearInterval(t) }, [annc.length])
  useEffect(() => {
    if (!settings) return
    if (settings.disclaimer?.enabled && !localStorage.getItem('ib_disclaimer_accepted_v1')) {
      setTimeout(() => setDisclaimer(true), 600)
    } else if (settings.popup?.enabled && !localStorage.getItem('ib_popup_seen_v2')) {
      setTimeout(() => { setPopup(true); localStorage.setItem('ib_popup_seen_v2', '1') }, 1200)
    }
  }, [settings])
  const acceptDisclaimer = () => { localStorage.setItem('ib_disclaimer_accepted_v1', '1'); setDisclaimer(false) }

  const dashBtns = [
    { k: 'recharge', icon: ArrowDownToLine, label: 'Recharge' },
    { k: 'withdraw', icon: ArrowUpFromLine, label: 'Withdraw' },
    { k: 'team', icon: Users, label: 'Invite' },
    { k: 'gift', icon: Gift, label: 'Gift Code' },
    { k: 'history', icon: HistoryIcon, label: 'History' },
    { k: 'orders', icon: ShoppingBag, label: 'Orders' },
    { k: 'about', icon: Info, label: 'About' },
    { k: 'support', icon: LifeBuoy, label: 'Support' },
  ]

  return (
    <div className="space-y-6 pb-28">
      {/* Banner slider */}
      {slides.length > 0 && (
        <div className="relative rounded-3xl overflow-hidden h-64 sm:h-80">
          <AnimatePresence mode="wait">
            <motion.div key={slide} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="absolute inset-0">
              <img src={slides[slide].image} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
              <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-center max-w-2xl">
                <Badge color="gold">{settings.siteName}</Badge>
                <h1 className="text-3xl sm:text-5xl font-extrabold mt-2 gold-text leading-tight">{slides[slide].title}</h1>
                <p className="text-white/80 mt-2">{slides[slide].subtitle}</p>
                <div className="mt-4"><GoldButton onClick={() => onNav(slides[slide].ctaLink || 'plans')}>{slides[slide].ctaText || 'Get Started'}</GoldButton></div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
            {slides.map((_, i) => <button key={i} onClick={() => setSlide(i)} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-8 bg-yellow-400' : 'w-2 bg-white/40'}`} />)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 sm:gap-3">
        {dashBtns.map(b => (
          <button key={b.k} onClick={() => onNav(b.k)} className="glass rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:bg-white/10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#fbe089,#b8860b)', color: '#1a1a2e' }}><b.icon size={18} /></div>
            <span className="text-[11px] text-white/80">{b.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Investors" value={fmtN(stats?.totalInvestors)} />
        <StatCard icon={TrendingUp} label="Running Investments" value={fmtN(stats?.runningInvestments)} />
        <StatCard icon={ArrowUpFromLine} label="Total Withdraw" value={fmt(stats?.totalWithdraw)} accent="#3b82f644" />
        <StatCard icon={Zap} label="Today's Profit" value={fmt(stats?.todayProfit)} accent="#10b98144" />
      </div>

      {annc.length > 0 && (
        <GlassCard className="p-4 flex items-center gap-3 overflow-hidden">
          <Bell size={18} className="text-yellow-300 shrink-0" />
          <AnimatePresence mode="wait">
            <motion.div key={annI} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-sm">
              <span className="font-semibold text-yellow-200">{annc[annI].title}: </span><span className="text-white/80">{annc[annI].message}</span>
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      )}

      <Section title="Featured Plans" icon={Layers}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.filter(p => p.featured).slice(0, 4).map(p => <PlanCard key={p.id} plan={p} onBuy={() => onNav('plans')} />)}
          {plans.filter(p => p.featured).length === 0 && plans.slice(0, 4).map(p => <PlanCard key={p.id} plan={p} onBuy={() => onNav('plans')} />)}
        </div>
      </Section>

      <TopInvestorsSection />

      <div className="grid sm:grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><ArrowDownToLine size={16} className="text-green-300" /> Latest Deposits</h3>
          <div className="space-y-2 max-h-56 overflow-auto no-scrollbar">
            {(stats?.latestDeposits || []).map((d, i) => <div key={i} className="flex justify-between text-sm border-b border-white/5 pb-1.5"><span className="text-white/60">User •••{(d.userId || '').slice(-4)}</span><span className="text-green-300">+{fmt(d.amount)}</span></div>)}
            {!stats?.latestDeposits?.length && <div className="text-xs text-white/40">No deposits yet.</div>}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><ArrowUpFromLine size={16} className="text-yellow-300" /> Latest Withdrawals</h3>
          <div className="space-y-2 max-h-56 overflow-auto no-scrollbar">
            {(stats?.latestWithdrawals || []).map((d, i) => <div key={i} className="flex justify-between text-sm border-b border-white/5 pb-1.5"><span className="text-white/60">User •••{(d.userId || '').slice(-4)}</span><span className="text-yellow-300">-{fmt(d.amount)}</span></div>)}
            {!stats?.latestWithdrawals?.length && <div className="text-xs text-white/40">No withdrawals yet.</div>}
          </div>
        </GlassCard>
      </div>

      <TestimonialsSection items={settings?.testimonials || []} />

      <Section title="FAQ" icon={Info}>
        <FAQ faq={settings?.faq || []} />
      </Section>

      <ContactSection contact={settings?.contact} social={settings?.socialLinks} />
      <Footer settings={settings} />

      <AnimatePresence>
        {disclaimer && settings?.disclaimer?.enabled && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} className="glass-strong rounded-3xl max-w-lg w-full p-6 border-2" style={{ borderColor: settings.disclaimer.color || '#f5c842' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${settings.disclaimer.color || '#f5c842'}, #b8860b)`, color: '#1a1a2e' }}><Shield size={24} /></div>
                <h2 className="text-2xl font-bold gold-text">{settings.disclaimer.title}</h2>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">{settings.disclaimer.message}</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-6">
                <GoldButton className="flex-1" onClick={acceptDisclaimer}><span className="flex items-center justify-center gap-2"><BadgeCheck size={16} /> {settings.disclaimer.acceptText || 'I Understand'}</span></GoldButton>
                <SoftButton onClick={() => { acceptDisclaimer(); onNav('terms') }} className="flex-1">{settings.disclaimer.viewTermsText || 'View Terms'}</SoftButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {popup && settings?.popup?.enabled && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPopup(false)}>
            <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} className="glass-strong rounded-3xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              {settings.popup.image && <img src={settings.popup.image} className="w-full h-40 object-cover rounded-xl mb-4" />}
              <h2 className="text-2xl font-bold gold-text">{settings.popup.title}</h2>
              <p className="text-white/70 mt-2">{settings.popup.message}</p>
              <div className="flex gap-2 mt-5">
                <GoldButton className="flex-1" onClick={() => { setPopup(false); if (settings.popup.ctaLink) onNav(settings.popup.ctaLink) }}>{settings.popup.ctaText || 'OK'}</GoldButton>
                <SoftButton onClick={() => setPopup(false)}>Close</SoftButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const Section = ({ title, icon: Icon, children }) => (
  <div><h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Icon size={18} className="text-yellow-300" /> {title}</h2>{children}</div>
)

function TopInvestorsSection() {
  const [d, setD] = useState(null)
  useEffect(() => { api('leaderboard').then(setD).catch(() => {}) }, [])
  if (!d) return null
  return (
    <Section title="Top Investors" icon={Trophy}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {(d.topInvestors || []).slice(0, 5).map((u, i) => (
          <GlassCard key={i} className="p-3 text-center">
            <div className="w-12 h-12 rounded-full mx-auto gold-btn !shadow-none flex items-center justify-center font-bold mb-2">{(u.name || '?')[0]}</div>
            <div className="font-semibold text-sm">{u.name}</div>
            <div className="text-xs gold-text font-bold mt-1">{fmt(u.investmentTotal)}</div>
            <Badge color={i === 0 ? 'gold' : i < 3 ? 'purple' : 'blue'}>#{i + 1}</Badge>
          </GlassCard>
        ))}
        {(!d.topInvestors || d.topInvestors.length === 0) && <div className="col-span-full text-white/40 text-sm">Be the first top investor!</div>}
      </div>
    </Section>
  )
}

function TestimonialsSection({ items }) {
  if (!items?.length) return null
  return (
    <Section title="What Our Investors Say" icon={Star}>
      <div className="grid sm:grid-cols-3 gap-3">
        {items.map(t => (
          <GlassCard key={t.id} className="p-4">
            <div className="flex gap-0.5 mb-2">{Array.from({ length: t.rating || 5 }).map((_, i) => <Star key={i} size={14} className="text-yellow-300 fill-yellow-300" />)}</div>
            <p className="text-sm text-white/80 italic">"{t.text}"</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-9 h-9 rounded-full gold-btn !shadow-none flex items-center justify-center font-bold text-sm">{t.name[0]}</div>
              <div><div className="text-sm font-semibold">{t.name}</div><div className="text-xs text-white/50">{t.role}</div></div>
            </div>
          </GlassCard>
        ))}
      </div>
    </Section>
  )
}

function ContactSection({ contact, social }) {
  if (!contact) return null
  return (
    <Section title="Contact & Community" icon={MessageSquare}>
      <GlassCard className="p-4 grid sm:grid-cols-2 gap-3 text-sm">
        <div><span className="text-white/50 text-xs">Email</span><div>{contact.email}</div></div>
        <div><span className="text-white/50 text-xs">Phone</span><div>{contact.phone}</div></div>
        <div><span className="text-white/50 text-xs">Telegram</span><div>{contact.telegram}</div></div>
        <div><span className="text-white/50 text-xs">WhatsApp</span><div>{contact.whatsapp}</div></div>
        <div className="sm:col-span-2"><span className="text-white/50 text-xs">Address</span><div>{contact.address}</div></div>
        <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2 border-t border-white/5">
          {(social || []).map((s, i) => <a key={i} href={s.url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10">{s.name}</a>)}
        </div>
      </GlassCard>
    </Section>
  )
}

function FAQ({ faq }) {
  const [open, setOpen] = useState(0)
  return <div className="space-y-2">{(faq || []).map((f, i) => (
    <GlassCard key={i} className="overflow-hidden">
      <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full p-4 flex items-center justify-between"><span className="text-sm font-medium">{f.q}</span><ChevronDown size={16} className={`transition ${open === i ? 'rotate-180' : ''}`} /></button>
      <AnimatePresence>{open === i && <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden"><div className="px-4 pb-4 text-sm text-white/70">{f.a}</div></motion.div>}</AnimatePresence>
    </GlassCard>
  ))}</div>
}

const Footer = ({ settings }) => <div className="text-center text-xs text-white/40 pt-6 pb-4">© 2025 {settings?.siteName || 'Investers Blueprint'} · All rights reserved · Built for premium investors</div>

// ============ Plans ============
function PlanCard({ plan, onBuy }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="h-32 relative" style={{ backgroundImage: `url(${plan.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b1a] to-transparent" />
        <div className="absolute top-2 right-2 flex gap-1">
          {plan.popular && <Badge color="purple">🔥 Popular</Badge>}
          {plan.recommended && <Badge color="gold">⭐ Recommended</Badge>}
          {plan.featured && <Badge color="blue">Featured</Badge>}
        </div>
        <div className="absolute bottom-2 left-3"><div className="font-bold gold-text text-lg">{plan.name}</div><div className="text-[10px] text-white/60">{plan.category}</div></div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-2 text-xs">
        <Stat l="Invest" v={fmt(plan.investAmount)} />
        <Stat l="Daily" v={fmt(plan.dailyProfit)} />
        <Stat l="Days" v={plan.validityDays} />
        <Stat l="Total" v={fmt(plan.totalProfit)} accent />
      </div>
      <div className="px-4 pb-4"><GoldButton disabled={plan.status !== 'active' || plan.enabled === false} onClick={onBuy} className="w-full">{plan.status === 'active' && plan.enabled !== false ? 'Invest Now' : 'Unavailable'}</GoldButton></div>
    </motion.div>
  )
}
const Stat = ({ l, v, accent }) => <div className="bg-white/5 rounded-lg p-2"><div className="text-white/50">{l}</div><div className={`font-bold ${accent ? 'gold-text' : 'text-white'}`}>{v}</div></div>

function PlansPage({ plans, onBuy }) {
  const [q, setQ] = useState(''); const [cat, setCat] = useState('all')
  const cats = ['all', ...new Set(plans.map(p => p.category).filter(Boolean))]
  const filtered = plans.filter(p => (cat === 'all' || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="space-y-4 pb-28">
      <header><h1 className="text-2xl font-bold gold-text">Investment Plans</h1><p className="text-white/60 text-sm">Choose a plan and start earning daily profits.</p></header>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" /><input placeholder="Search plans…" value={q} onChange={e => setQ(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm" /></div>
        <select value={cat} onChange={e => setCat(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm">{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map(p => <PlanCard key={p.id} plan={p} onBuy={() => onBuy(p)} />)}</div>
    </div>
  )
}

// ============ Orders ============
function OrdersPage({ refresh }) {
  const [orders, setOrders] = useState([]); const [tick, setTick] = useState(0)
  const load = () => api('orders').then(r => setOrders(r.orders))
  useEffect(() => { load(); const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t) }, [])
  const collect = async (id) => { try { const r = await api(`orders/${id}/collect`, { method: 'POST' }); toast.success(`Collected ${fmt(r.profit)}!${r.completed ? ' Plan completed.' : ''}`); await load(); refresh() } catch (e) { toast.error(e.message) } }
  return (
    <div className="space-y-4 pb-28">
      <header><h1 className="text-2xl font-bold gold-text">My Orders</h1><p className="text-white/60 text-sm">Collect your profit at every interval.</p></header>
      {!orders.length && <GlassCard className="p-8 text-center text-white/60">No orders yet. Buy a plan to start earning!</GlassCard>}
      <div className="grid sm:grid-cols-2 gap-3">{orders.map(o => <OrderCard key={o.id} order={o} onCollect={() => collect(o.id)} tick={tick} />)}</div>
    </div>
  )
}
function OrderCard({ order, onCollect, tick }) {
  const remaining = Math.max(0, new Date(order.nextCollectAt).getTime() - Date.now())
  const h = Math.floor(remaining / 3600000), m = Math.floor((remaining % 3600000) / 60000), s = Math.floor((remaining % 60000) / 1000)
  const ready = remaining === 0 && order.status === 'active'
  const p = order.planSnapshot
  const completed = order.status === 'completed' || order.status === 'expired'
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex gap-3 p-3">
        <img src={p.image} className="w-20 h-20 rounded-xl object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between"><h3 className="font-bold gold-text">{p.name}</h3><StatusBadge s={order.status} /></div>
          <div className="grid grid-cols-3 gap-1 mt-2 text-[11px]">
            <Mini l="Invest" v={fmt(p.investAmount)} /><Mini l="Daily" v={fmt(p.dailyProfit)} /><Mini l="Earned" v={fmt(order.totalEarned)} accent />
          </div>
        </div>
      </div>
      <div className="px-3 pb-3 flex items-center gap-2">
        <div className="flex-1">
          <div className="text-[10px] text-white/50">Next collect in</div>
          <div className={`font-mono font-bold ${ready ? 'text-green-300' : 'text-white'}`}>{ready ? 'READY' : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`}</div>
          <div className="text-[10px] text-white/40">{order.collectedDays}/{p.validityDays} days</div>
        </div>
        <GoldButton disabled={!ready || completed} onClick={onCollect} className="!px-4 !py-2 text-sm">{completed ? 'Done' : (ready ? 'Collect' : 'Wait')}</GoldButton>
      </div>
    </GlassCard>
  )
}
const Mini = ({ l, v, accent }) => <div className="bg-white/5 rounded-md px-2 py-1"><div className="text-white/50">{l}</div><div className={`font-bold ${accent ? 'gold-text' : 'text-white'}`}>{v}</div></div>

// ============ Team ============
function TeamPage() {
  const [d, setD] = useState(null); const [lb, setLb] = useState(null); const [showTree, setShowTree] = useState(false)
  useEffect(() => { api('team').then(setD); api('leaderboard').then(setLb) }, [])
  if (!d) return <div className="text-white/60 p-8 text-center">Loading…</div>
  return (
    <div className="space-y-4 pb-28">
      <header><h1 className="text-2xl font-bold gold-text">My Team</h1><p className="text-white/60 text-sm">Earn commissions across {d.settings.maxLevels} levels.</p></header>
      <GlassCard className="p-5 flex flex-col sm:flex-row items-center gap-5">
        <div className="bg-white p-3 rounded-xl"><QRCodeCanvas value={d.referralLink} size={120} /></div>
        <div className="flex-1 w-full">
          <div className="text-xs text-white/50 mb-1">Your referral code</div>
          <div className="text-2xl font-bold gold-text">{d.referralCode}</div>
          <div className="mt-3 flex gap-2">
            <input readOnly value={d.referralLink} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs" />
            <GoldButton onClick={() => { navigator.clipboard.writeText(d.referralLink); toast.success('Copied!') }} className="!px-3 !py-2"><Copy size={14} /></GoldButton>
          </div>
          <div className="text-xs text-white/50 mt-2 flex gap-2 flex-wrap">{d.settings.levels.slice(0, d.settings.maxLevels).map((p, i) => <Badge key={i} color="gold">L{i + 1}: {p}%</Badge>)}</div>
        </div>
      </GlassCard>
      <div className={`grid grid-cols-${Math.min(d.totals.length || 3, 5)} gap-2`}>{d.totals.map((t, i) => <StatCard key={i} icon={Users} label={`Level ${i + 1}`} value={t} />)}</div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Users} label="Total Team" value={d.totalMembers || 0} accent="#a855f744" />
        <StatCard icon={ShoppingBag} label="Team Investment" value={fmt(d.totalTeamInvestment || 0)} accent="#3b82f644" />
        <StatCard icon={Zap} label="Referral Income" value={fmt(d.referralIncome)} accent="#10b98144" />
      </div>
      <div className="flex gap-2">
        <SoftButton className="flex-1" onClick={() => setShowTree(!showTree)}><span className="flex items-center justify-center gap-2"><Network size={14} /> {showTree ? 'Hide' : 'Show'} Referral Tree</span></SoftButton>
      </div>
      {showTree && (
        <div className="space-y-4">
          {d.tree.map((lvl, i) => (
            <GlassCard key={i} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2"><Badge color="gold">Level {i + 1}</Badge><span className="text-sm text-white/60">{lvl.length} member{lvl.length !== 1 ? 's' : ''} · {d.settings.levels[i]}% commission</span></h3>
              </div>
              {lvl.length === 0 && <div className="text-xs text-white/40">No members at this level yet</div>}
              <div className="space-y-2">
                {lvl.map(u => (
                  <div key={u.id} className="bg-white/5 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="sm:col-span-1"><div className="text-white/50">Name</div><div className="font-semibold text-sm truncate">{u.name}</div><div className="text-[10px] text-white/40 truncate">ID: {u.id.slice(0, 8)}</div></div>
                    <div><div className="text-white/50">Joined</div><div>{new Date(u.createdAt).toLocaleDateString()}</div></div>
                    <div><div className="text-white/50">Active Plans</div><div className="font-bold">{u.activePlans}</div></div>
                    <div><div className="text-white/50">Invested</div><div className="gold-text font-bold">{fmt(u.investmentTotal)}</div></div>
                    <div className="sm:col-span-2"><div className="text-white/50">Commission generated for you</div><div className="text-green-300 font-bold">{fmt(u.commissionGenerated)}</div></div>
                    <div><div className="text-white/50">Status</div><Badge color={u.status === 'active' ? 'green' : u.status === 'blocked' ? 'red' : 'blue'}>{u.status}</Badge></div>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      <GlassCard className="p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><Trophy size={16} className="text-yellow-300" /> Top Referrers Leaderboard</h3>
        <div className="space-y-1">{(lb?.topReferrers || []).slice(0, 10).map((u, i) => (
          <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/5"><span className="text-sm flex items-center gap-2"><Badge color={i === 0 ? 'gold' : i < 3 ? 'purple' : 'blue'}>#{i + 1}</Badge>{u.name}</span><span className="text-sm gold-text font-bold">{fmt(u.referralIncome)}</span></div>
        ))}</div>
      </GlassCard>
      <GlassCard className="p-4">
        <h3 className="font-semibold mb-2">Recent Commissions — <span className="gold-text">{fmt(d.referralIncome)}</span></h3>
        <div className="space-y-1 max-h-64 overflow-auto no-scrollbar">{d.commissions.length === 0 && <div className="text-xs text-white/50">No commissions yet.</div>}{d.commissions.map((c, i) => <div key={i} className="flex justify-between text-sm border-b border-white/5 py-1"><span className="text-white/70">L{c.meta?.level} commission</span><span className="text-green-300">+{fmt(c.amount)}</span></div>)}</div>
      </GlassCard>
    </div>
  )
}

// ============ Mine ============
function MinePage({ user, onNav, onLogout }) {
  const W = ({ k, label, color }) => <div className="bg-white/5 rounded-xl p-3"><div className="text-xs text-white/50">{label}</div><div className={`text-lg font-bold ${color || 'gold-text'}`}>{fmt(user.wallets?.[k] || 0)}</div></div>
  return (
    <div className="space-y-4 pb-28">
      <GlassCard className="p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full gold-btn !shadow-none flex items-center justify-center text-2xl font-bold">{(user.name || user.email)[0]?.toUpperCase()}</div>
        <div className="flex-1 min-w-0"><div className="font-bold text-lg">{user.name}</div><div className="text-white/60 text-xs truncate">{user.email}</div><div className="text-[10px] text-white/40 mt-1">Code: <span className="text-yellow-300 font-semibold">{user.referralCode}</span></div></div>
      </GlassCard>
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">My Wallets · Total <span className="gold-text">{fmt(user.totalBalance)}</span></h3><SoftButton className="!px-3 !py-1 text-xs" onClick={() => onNav('transfer')}><span className="flex items-center gap-1"><ArrowLeftRight size={12} /> Transfer</span></SoftButton></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><W k="main" label="Main Wallet" /><W k="profit" label="Profit Wallet" color="text-green-300" /><W k="referral" label="Referral Wallet" color="text-purple-300" /><W k="bonus" label="Bonus Wallet" color="text-blue-300" /></div>
      </GlassCard>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp} label="Today's Income" value={fmt(user.todayIncome)} accent="#10b98144" />
        <StatCard icon={ArrowDownToLine} label="Recharge Total" value={fmt(user.rechargeTotal)} accent="#3b82f644" />
        <StatCard icon={ArrowUpFromLine} label="Withdraw Total" value={fmt(user.withdrawTotal)} />
        <StatCard icon={ShoppingBag} label="Investment Total" value={fmt(user.investmentTotal)} />
        <StatCard icon={Zap} label="Total Profit" value={fmt(user.totalProfit)} accent="#10b98144" />
        <StatCard icon={Users} label="Referral Income" value={fmt(user.referralIncome)} accent="#a855f744" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={ShoppingBag} label="Active Plans" value={user.stats?.activePlans || 0} accent="#10b98144" />
        <StatCard icon={BadgeCheck} label="Completed Plans" value={user.stats?.completedPlans || 0} accent="#3b82f644" />
        <StatCard icon={ArrowDownToLine} label="Pending Recharges" value={user.stats?.pendingRecharges || 0} />
        <StatCard icon={ArrowUpFromLine} label="Pending Withdrawals" value={user.stats?.pendingWithdrawals || 0} accent="#a855f744" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[['orders', ShoppingBag, 'Orders'], ['recharge', ArrowDownToLine, 'Recharge'], ['withdraw', ArrowUpFromLine, 'Withdraw'], ['transfer', ArrowLeftRight, 'Transfer'], ['history', HistoryIcon, 'History'], ['gift', Gift, 'Gift Redeem'], ['bank', Building2, 'Bank Details'], ['password', KeySquare, 'Password'], ['support', LifeBuoy, 'Support'], ['about', Info, 'About'], ['terms', FileText, 'Terms'], ['privacy', FileText, 'Privacy']].map(([k, Ic, l]) => (
          <button key={k} onClick={() => onNav(k)} className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/10"><Ic size={16} className="text-yellow-300" /><span className="text-sm">{l}</span><ChevronRight size={14} className="ml-auto text-white/40" /></button>
        ))}
      </div>
      <SoftButton onClick={onLogout} className="w-full !text-red-300"><span className="flex items-center justify-center gap-2"><LogOut size={14} /> Logout</span></SoftButton>
    </div>
  )
}

// ============ Wallet Transfer ============
function TransferPage({ user, refresh }) {
  const [from, setFrom] = useState('profit'); const [to, setTo] = useState('main'); const [amount, setAmount] = useState('')
  const submit = async () => { try { await api('wallet/transfer', { method: 'POST', body: { from, to, amount: +amount } }); toast.success('Transferred'); setAmount(''); refresh() } catch (e) { toast.error(e.message) } }
  const opts = [{ value: 'main', label: 'Main' }, { value: 'profit', label: 'Profit' }, { value: 'referral', label: 'Referral' }, { value: 'bonus', label: 'Bonus' }]
  return (
    <div className="space-y-4 pb-28">
      <h1 className="text-2xl font-bold gold-text">Wallet Transfer</h1>
      <GlassCard className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">{['main', 'profit', 'referral', 'bonus'].map(k => <div key={k} className="bg-white/5 rounded-lg p-2"><div className="text-xs text-white/50 capitalize">{k}</div><div className="font-bold gold-text">{fmt(user.wallets?.[k] || 0)}</div></div>)}</div>
        <div className="grid grid-cols-2 gap-2"><Select value={from} onChange={setFrom} options={opts.filter(o => o.value !== to).concat(opts.find(o => o.value === to) ? [] : [])} /><Select value={to} onChange={setTo} options={opts.filter(o => o.value !== from)} /></div>
        <Input placeholder="Amount" type="number" value={amount} onChange={setAmount} />
        <GoldButton className="w-full" onClick={submit}>Transfer {fmt(+amount || 0)}</GoldButton>
      </GlassCard>
    </div>
  )
}

// ============ Recharge / Withdraw / Gift / History / Bank / Password / About / Support / CMS / Notifications ============
function RechargePage({ settings, refresh }) {
  const [amount, setAmount] = useState(''); const [txId, setTxId] = useState(''); const [screenshot, setScreenshot] = useState(''); const [method, setMethod] = useState('')
  const [items, setItems] = useState([])
  const load = () => api('recharges').then(r => setItems(r.items))
  useEffect(() => { load(); if (settings?.paymentMethods?.[0]) setMethod(settings.paymentMethods[0].id) }, [settings])
  const submit = async () => { try { await api('recharges', { method: 'POST', body: { amount: +amount, txId, screenshot, method } }); toast.success('Recharge submitted'); setAmount(''); setTxId(''); setScreenshot(''); load(); refresh() } catch (e) { toast.error(e.message) } }
  const selectedPM = settings?.paymentMethods?.find(p => p.id === method)
  return (
    <div className="space-y-4 pb-28">
      <h1 className="text-2xl font-bold gold-text">Recharge Wallet</h1>
      <GlassCard className="p-5 space-y-3">
        <div className="text-xs text-white/60">Min {fmt(settings?.minRecharge)} · Max {fmt(settings?.maxRecharge)} {settings?.autoApproveRecharge && <Badge color="green">Auto-approve</Badge>}</div>
        <Select value={method} onChange={setMethod} options={(settings?.paymentMethods || []).filter(p => p.enabled !== false).map(p => ({ value: p.id, label: `${p.type} · ${p.name}` }))} />
        {selectedPM && <div className="bg-white/5 rounded-xl p-3 text-xs space-y-1"><div className="text-white/60">Pay to:</div><div className="font-mono text-yellow-300 break-all">{selectedPM.details}</div>{selectedPM.qrCode && <img src={selectedPM.qrCode} className="h-32 mx-auto rounded mt-2" />}</div>}
        <Input placeholder="Amount" type="number" value={amount} onChange={setAmount} />
        <Input placeholder="Transaction ID" value={txId} onChange={setTxId} />
        <Input placeholder="Payment screenshot URL" value={screenshot} onChange={setScreenshot} />
        <GoldButton className="w-full" onClick={submit}>Submit Request</GoldButton>
      </GlassCard>
      <h2 className="font-semibold">My Recharges</h2>
      {items.map(r => <GlassCard key={r.id} className="p-3 flex justify-between text-sm"><div><span className="font-bold gold-text">{fmt(r.amount)}</span><div className="text-white/50 text-xs">{r.txId || '—'}</div></div><StatusBadge s={r.status} /></GlassCard>)}
    </div>
  )
}

function WithdrawPage({ user, settings, refresh }) {
  const [amount, setAmount] = useState(''); const [method, setMethod] = useState('UPI'); const [details, setDetails] = useState('')
  const [items, setItems] = useState([])
  const load = () => api('withdraws').then(r => setItems(r.items))
  useEffect(() => { load() }, [])
  const fee = (+amount || 0) * (settings?.withdrawFeePct || 0) / 100
  const net = (+amount || 0) - fee
  const submit = async () => { try { await api('withdraws', { method: 'POST', body: { amount: +amount, method, details } }); toast.success('Submitted'); setAmount(''); setDetails(''); load(); refresh() } catch (e) { toast.error(e.message) } }
  return (
    <div className="space-y-4 pb-28">
      <h1 className="text-2xl font-bold gold-text">Withdraw</h1>
      <GlassCard className="p-5 space-y-3">
        <div className="text-sm text-white/70">Main Wallet: <span className="gold-text font-bold">{fmt(user.wallets?.main)}</span></div>
        <div className="text-xs text-white/50">Min {fmt(settings?.minWithdraw)} · Max {fmt(settings?.maxWithdraw)} · Daily limit {fmt(settings?.dailyWithdrawLimit)} · Fee {settings?.withdrawFeePct}% · Processing ~{settings?.processingTimeHours}h</div>
        <Input placeholder="Amount" type="number" value={amount} onChange={setAmount} />
        {amount && <div className="text-xs text-white/60">Fee: {fmt(fee)} · You receive: <span className="gold-text font-bold">{fmt(net)}</span></div>}
        <Select value={method} onChange={setMethod} options={['UPI', 'Bank', 'Crypto']} />
        <Input placeholder="Account / UPI / Wallet address" value={details} onChange={setDetails} />
        <GoldButton className="w-full" onClick={submit}>Submit Withdraw</GoldButton>
      </GlassCard>
      <h2 className="font-semibold">My Withdrawals</h2>
      {items.map(r => <GlassCard key={r.id} className="p-3 flex justify-between text-sm"><div><span className="font-bold gold-text">{fmt(r.amount)}</span><div className="text-white/50 text-xs">{r.method} · Fee {fmt(r.fee || 0)} · Net {fmt(r.net || r.amount)}</div></div><StatusBadge s={r.status} /></GlassCard>)}
    </div>
  )
}

function GiftPage({ refresh }) {
  const [code, setCode] = useState('')
  const redeem = async () => { try { const r = await api('gifts/redeem', { method: 'POST', body: { code } }); toast.success(`Redeemed ${fmt(r.reward)} → ${r.wallet}`); setCode(''); refresh() } catch (e) { toast.error(e.message) } }
  return (
    <div className="space-y-4 pb-28">
      <h1 className="text-2xl font-bold gold-text">Gift Code Redemption</h1>
      <GlassCard className="p-5 space-y-3"><Input placeholder="Enter gift code" value={code} onChange={v => setCode(v.toUpperCase())} /><GoldButton onClick={redeem} className="w-full">Redeem</GoldButton></GlassCard>
    </div>
  )
}

function HistoryPage() {
  const [items, setItems] = useState([]); const [type, setType] = useState('')
  useEffect(() => { api('history' + (type ? `?type=${type}` : '')).then(r => setItems(r.items)) }, [type])
  const labels = { investment: 'Investment', daily_profit: 'Daily Profit', referral: 'Referral', recharge: 'Recharge', withdraw: 'Withdraw', gift: 'Gift', bonus: 'Bonus', transfer: 'Transfer' }
  return (
    <div className="space-y-3 pb-28">
      <h1 className="text-2xl font-bold gold-text">History</h1>
      <Select value={type} onChange={setType} options={[{ value: '', label: 'All Types' }, ...Object.entries(labels).map(([v, l]) => ({ value: v, label: l }))]} />
      {!items.length && <GlassCard className="p-6 text-center text-white/50">No transactions yet.</GlassCard>}
      {items.map(t => (
        <GlassCard key={t.id} className="p-3 flex justify-between text-sm">
          <div><div className="font-medium flex items-center gap-2">{labels[t.type] || t.type} {t.wallet && <Badge color="blue">{t.wallet}</Badge>}</div><div className="text-xs text-white/40">{new Date(t.createdAt).toLocaleString()}</div></div>
          <div className={`font-bold ${t.amount >= 0 ? 'text-green-300' : 'text-red-300'}`}>{t.amount >= 0 ? '+' : ''}{fmt(t.amount)}</div>
        </GlassCard>
      ))}
    </div>
  )
}

function BankPage({ user, refresh }) {
  const [d, setD] = useState(user.bankDetails || { holderName: '', account: '', ifsc: '', upi: '' })
  const save = async () => { await api('me', { method: 'PATCH', body: { bankDetails: d } }); toast.success('Saved'); refresh() }
  return (<div className="space-y-4 pb-28"><h1 className="text-2xl font-bold gold-text">Bank Details</h1><GlassCard className="p-5 space-y-3"><Input placeholder="Account Holder" value={d.holderName} onChange={v => setD({ ...d, holderName: v })} /><Input placeholder="Account Number" value={d.account} onChange={v => setD({ ...d, account: v })} /><Input placeholder="IFSC / SWIFT" value={d.ifsc} onChange={v => setD({ ...d, ifsc: v })} /><Input placeholder="UPI ID" value={d.upi} onChange={v => setD({ ...d, upi: v })} /><GoldButton className="w-full" onClick={save}>Save</GoldButton></GlassCard></div>)
}

function PasswordPage() {
  const [o, setO] = useState(''); const [n, setN] = useState('')
  const save = async () => { try { await api('me', { method: 'PATCH', body: { oldPassword: o, newPassword: n } }); toast.success('Password updated'); setO(''); setN('') } catch (e) { toast.error(e.message) } }
  return (<div className="space-y-4 pb-28"><h1 className="text-2xl font-bold gold-text">Change Password</h1><GlassCard className="p-5 space-y-3"><Input type="password" placeholder="Old password" value={o} onChange={setO} /><Input type="password" placeholder="New password" value={n} onChange={setN} /><GoldButton className="w-full" onClick={save}>Update</GoldButton></GlassCard></div>)
}

function CMSPage({ settings, page }) {
  const html = settings?.pages?.[page] || '<p>Content coming soon.</p>'
  return (<div className="space-y-4 pb-28"><h1 className="text-2xl font-bold gold-text capitalize">{page}</h1><GlassCard className="p-5 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} /></div>)
}

function NotificationsPage({ settings }) {
  return (<div className="space-y-4 pb-28"><h1 className="text-2xl font-bold gold-text">Notifications</h1>{(settings?.announcements || []).map(a => <GlassCard key={a.id} className="p-4"><div className="font-semibold text-yellow-300">{a.title}</div><div className="text-sm text-white/80 mt-1">{a.message}</div><div className="text-xs text-white/40 mt-1">{new Date(a.createdAt).toLocaleString()}</div></GlassCard>)}</div>)
}

function SupportPage() {
  const [tickets, setTickets] = useState([]); const [subject, setSubject] = useState(''); const [msg, setMsg] = useState('')
  const [active, setActive] = useState(null); const [reply, setReply] = useState('')
  const load = () => api('tickets').then(r => setTickets(r.items))
  useEffect(() => { load() }, [])
  const create = async () => { if (!msg) return; await api('tickets', { method: 'POST', body: { subject, message: msg } }); setSubject(''); setMsg(''); load() }
  const send = async () => { if (!reply || !active) return; await api(`tickets/${active.id}/reply`, { method: 'POST', body: { message: reply } }); setReply(''); const r = await api('tickets'); setTickets(r.items); setActive(r.items.find(t => t.id === active.id)) }
  return (
    <div className="space-y-4 pb-28">
      <h1 className="text-2xl font-bold gold-text">Support</h1>
      {!active && <>
        <GlassCard className="p-5 space-y-3"><Input placeholder="Subject" value={subject} onChange={setSubject} /><Textarea placeholder="Describe your issue…" value={msg} onChange={setMsg} className="h-24" /><GoldButton className="w-full" onClick={create}>Open Ticket</GoldButton></GlassCard>
        <h2 className="font-semibold">My Tickets</h2>
        {tickets.map(t => <button key={t.id} onClick={() => setActive(t)} className="w-full text-left glass rounded-xl p-3 flex items-center justify-between"><div><div className="font-medium">{t.subject}</div><div className="text-xs text-white/50">{t.messages.length} messages</div></div><StatusBadge s={t.status} /></button>)}
      </>}
      {active && <GlassCard className="p-4 flex flex-col h-[70vh]">
        <div className="flex items-center justify-between mb-3"><div><div className="font-bold">{active.subject}</div><StatusBadge s={active.status} /></div><button onClick={() => setActive(null)} className="text-white/50"><X size={16} /></button></div>
        <div className="flex-1 overflow-auto space-y-2 no-scrollbar">{active.messages.map((m, i) => <div key={i} className={`max-w-[80%] p-2.5 rounded-xl text-sm ${m.from === 'user' ? 'ml-auto bg-yellow-400/15 border border-yellow-400/30' : 'bg-white/5 border border-white/10'}`}>{m.text}<div className="text-[10px] text-white/40 mt-1">{new Date(m.at).toLocaleString()}</div></div>)}</div>
        <div className="mt-2 flex gap-2"><input value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply…" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" /><GoldButton onClick={send} className="!px-4">Send</GoldButton></div>
      </GlassCard>}
    </div>
  )
}

// ============ Admin ============
function AdminPanel({ user, onExit, refresh }) {
  const [tab, setTab] = useState('dash')
  const tabs = [['dash', 'Dashboard', BarChart3], ['users', 'Users', Users], ['plans', 'Plans', Layers], ['referral', 'Referral / Team', Network], ['deposits', 'Deposits', ArrowDownToLine], ['withdraws', 'Withdrawals', ArrowUpFromLine], ['orders', 'Orders', ShoppingBag], ['gifts', 'Gifts', Gift], ['announce', 'Announce', Bell], ['cms', 'CMS', FileText], ['payment', 'Payments', Building2], ['banner', 'Banner', ImageIcon], ['testimonial', 'Testimonials', Star], ['settings', 'Settings', Settings], ['logs', 'Login Logs', Eye]]
  return (
    <div className="min-h-screen aurora">
      <div className="border-b border-white/5 bg-black/30 backdrop-blur sticky top-0 z-30"><div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3"><Shield className="text-yellow-300" /><div className="font-bold">Admin Console</div><span className="text-xs text-white/40">Premium Investment Platform</span><button onClick={onExit} className="ml-auto px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center gap-1"><Home size={14} /> User View</button></div></div>
      <div className="max-w-7xl mx-auto px-4 py-4 grid lg:grid-cols-[220px_1fr] gap-4">
        <div className="lg:sticky top-20 self-start overflow-x-auto no-scrollbar"><div className="flex lg:flex-col gap-1">{tabs.map(([k, l, Ic]) => <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap ${tab === k ? 'gold-btn !shadow-none' : 'bg-white/5 border border-white/10'}`}><Ic size={14} /> {l}</button>)}</div></div>
        <div className="min-w-0">
          {tab === 'dash' && <AdminDash />}
          {tab === 'users' && <AdminUsers />}
          {tab === 'plans' && <AdminPlans />}
          {tab === 'referral' && <AdminReferral />}
          {tab === 'deposits' && <AdminApprovals collection="recharges" />}
          {tab === 'withdraws' && <AdminApprovals collection="withdraws" />}
          {tab === 'orders' && <AdminOrders />}
          {tab === 'gifts' && <AdminGifts />}
          {tab === 'announce' && <AdminAnnounce />}
          {tab === 'cms' && <AdminCMS />}
          {tab === 'payment' && <AdminPaymentMethods />}
          {tab === 'banner' && <AdminBanner />}
          {tab === 'testimonial' && <AdminTestimonials />}
          {tab === 'settings' && <AdminSettings />}
          {tab === 'logs' && <AdminLogs />}
        </div>
      </div>
    </div>
  )
}

function AdminDash() {
  const [s, setS] = useState(null)
  useEffect(() => { api('admin/stats').then(setS) }, [])
  if (!s) return <div className="text-white/60">Loading…</div>
  const COLORS = ['#f5c842', '#3b82f6', '#10b981', '#a855f7', '#ef4444']
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={s.users} />
        <StatCard icon={BadgeCheck} label="Active Users" value={s.active} accent="#10b98144" />
        <StatCard icon={Power} label="Blocked" value={s.blocked} accent="#ef444444" />
        <StatCard icon={Sparkles} label="Today Reg" value={s.todayReg} />
        <StatCard icon={ArrowDownToLine} label="Today Deposits" value={fmt(s.todayDeposits)} accent="#3b82f644" />
        <StatCard icon={ArrowUpFromLine} label="Today Withdraws" value={fmt(s.todayWithdrawals)} />
        <StatCard icon={Zap} label="Today Profit" value={fmt(s.todayProfit)} accent="#10b98144" />
        <StatCard icon={ShoppingBag} label="Total Investments" value={fmt(s.totalInvestments)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <GlassCard className="p-4"><h3 className="font-semibold mb-2">Last 7 Days Revenue</h3><div className="h-64"><ResponsiveContainer><AreaChart data={s.revenueChart}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5c842" stopOpacity={0.6} /><stop offset="100%" stopColor="#f5c842" stopOpacity={0} /></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="day" stroke="#999" fontSize={11} /><YAxis stroke="#999" fontSize={11} /><RTooltip contentStyle={{ background: '#0f1530', border: '1px solid #333' }} /><Area type="monotone" dataKey="deposits" stroke="#f5c842" fill="url(#g1)" /><Area type="monotone" dataKey="withdrawals" stroke="#3b82f6" fill="url(#g2)" /></AreaChart></ResponsiveContainer></div></GlassCard>
        <GlassCard className="p-4"><h3 className="font-semibold mb-2">Profit & Signups</h3><div className="h-64"><ResponsiveContainer><LineChart data={s.revenueChart}><XAxis dataKey="day" stroke="#999" fontSize={11} /><YAxis stroke="#999" fontSize={11} /><RTooltip contentStyle={{ background: '#0f1530', border: '1px solid #333' }} /><Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} /><Line type="monotone" dataKey="signups" stroke="#a855f7" strokeWidth={2} /></LineChart></ResponsiveContainer></div></GlassCard>
        <GlassCard className="p-4"><h3 className="font-semibold mb-2">Top Plans</h3><div className="h-64"><ResponsiveContainer><BarChart data={s.topPlans}><XAxis dataKey="_id" stroke="#999" fontSize={11} /><YAxis stroke="#999" fontSize={11} /><RTooltip contentStyle={{ background: '#0f1530', border: '1px solid #333' }} /><Bar dataKey="total" fill="#f5c842" /></BarChart></ResponsiveContainer></div></GlassCard>
        <GlassCard className="p-4"><h3 className="font-semibold mb-2">Latest Activity</h3><div className="space-y-1 max-h-60 overflow-auto no-scrollbar text-sm">{s.latestActivity.map((a, i) => <div key={i} className="flex justify-between border-b border-white/5 py-1"><span className="text-white/70">{a.type}</span><span className={a.amount >= 0 ? 'text-green-300' : 'text-red-300'}>{a.amount >= 0 ? '+' : ''}{fmt(a.amount)}</span></div>)}</div></GlassCard>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <GlassCard className="p-4"><h3 className="font-semibold mb-2">Top Investors</h3>{s.topUsers.map((u, i) => <div key={i} className="flex justify-between py-1 text-sm border-b border-white/5"><span>#{i + 1} {u.name}</span><span className="gold-text">{fmt(u.investmentTotal)}</span></div>)}</GlassCard>
        <GlassCard className="p-4"><h3 className="font-semibold mb-2">Top Referrers</h3>{s.topReferrers.map((u, i) => <div key={i} className="flex justify-between py-1 text-sm border-b border-white/5"><span>#{i + 1} {u.name}</span><span className="gold-text">{fmt(u.referralIncome)}</span></div>)}</GlassCard>
      </div>
    </div>
  )
}

function AdminUsers() {
  const [users, setUsers] = useState([]); const [q, setQ] = useState(''); const [edit, setEdit] = useState(null)
  const load = () => api('admin/users' + (q ? `?q=${q}` : '')).then(r => setUsers(r.users))
  useEffect(() => { load() }, [])
  const toggle = async (u) => { await api(`admin/users/${u.id}`, { method: 'PATCH', body: { blocked: !u.blocked } }); load() }
  const del = async (u) => { if (!await askConfirm(`Delete user ${u.name}? This cannot be undone.`)) return; await api(`admin/users/${u.id}`, { method: 'DELETE' }); toast.success('User deleted'); load() }
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" /><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Search name / email / referral code…" className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm" /></div><GoldButton onClick={load} className="!px-4">Search</GoldButton></div>
      <GlassCard className="p-3 overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-white/50 text-xs"><th className="text-left p-2">User</th><th>Main</th><th>Profit</th><th>Referral</th><th>Bonus</th><th>Status</th><th></th></tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id} className="border-t border-white/5">
              <td className="p-2"><div className="font-medium">{u.name}</div><div className="text-xs text-white/40">{u.email}</div></td>
              <td className="text-center text-yellow-300">{fmt(u.wallets?.main)}</td>
              <td className="text-center text-green-300">{fmt(u.wallets?.profit)}</td>
              <td className="text-center text-purple-300">{fmt(u.wallets?.referral)}</td>
              <td className="text-center text-blue-300">{fmt(u.wallets?.bonus)}</td>
              <td className="text-center"><StatusBadge s={u.blocked ? 'rejected' : 'approved'} /></td>
              <td className="text-right space-x-1">
                <button onClick={() => setEdit(u)} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs">Edit</button>
                <button onClick={() => toggle(u)} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs">{u.blocked ? 'Unblock' : 'Block'}</button>
                <button onClick={() => del(u)} className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs">Del</button>
              </td>
            </tr>))}</tbody>
        </table>
      </GlassCard>
      {edit && <UserEditModal user={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

function UserEditModal({ user, onClose, onSaved }) {
  const [w, setW] = useState(user.wallets || { main: 0, profit: 0, referral: 0, bonus: 0 })
  const [pwd, setPwd] = useState('')
  const save = async () => { await api(`admin/users/${user.id}`, { method: 'PATCH', body: { wallets: { main: +w.main, profit: +w.profit, referral: +w.referral, bonus: +w.bonus }, ...(pwd ? { resetPassword: pwd } : {}) } }); toast.success('Saved'); onSaved() }
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold">Edit {user.name}</h3><button onClick={onClose}><X size={16} /></button></div>
        <div className="grid grid-cols-2 gap-2">{['main', 'profit', 'referral', 'bonus'].map(k => <div key={k}><div className="text-xs text-white/50 capitalize">{k} wallet</div><Input type="number" value={w[k]} onChange={v => setW({ ...w, [k]: v })} /></div>)}</div>
        <div className="mt-3"><div className="text-xs text-white/50">Reset password (optional)</div><Input type="password" value={pwd} onChange={setPwd} /></div>
        <GoldButton className="w-full mt-4" onClick={save}>Save</GoldButton>
      </div>
    </div>
  )
}

function AdminPlans() {
  const [plans, setPlans] = useState([]); const empty = { name: '', image: '', investAmount: '', dailyProfit: '', validityDays: '', category: 'Basic', sortOrder: 0, featured: false, popular: false, recommended: false }
  const [form, setForm] = useState(empty)
  const load = () => api('plans').then(r => setPlans(r.plans))
  useEffect(() => { load() }, [])
  const save = async () => { await api('plans', { method: 'POST', body: form }); setForm(empty); load(); toast.success('Created') }
  const upd = async (id, patch) => { await api(`plans/${id}`, { method: 'PATCH', body: patch }); load() }
  const dup = async (id) => { await api('plans/duplicate', { method: 'POST', body: { id } }); load(); toast.success('Duplicated') }
  const del = async (id) => { if (!await askConfirm('Delete this plan permanently? Users who already purchased will keep their orders.')) return; try { await api(`plans/${id}`, { method: 'DELETE' }); toast.success('Plan deleted'); load() } catch (e) { toast.error(e.message) } }
  return (
    <div className="space-y-3">
      <GlassCard className="p-4 grid sm:grid-cols-3 gap-2">
        <Input placeholder="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
        <Input placeholder="Category" value={form.category} onChange={v => setForm({ ...form, category: v })} />
        <Input placeholder="Image URL" value={form.image} onChange={v => setForm({ ...form, image: v })} />
        <Input placeholder="Invest" type="number" value={form.investAmount} onChange={v => setForm({ ...form, investAmount: v })} />
        <Input placeholder="Daily profit" type="number" value={form.dailyProfit} onChange={v => setForm({ ...form, dailyProfit: v })} />
        <Input placeholder="Validity (days)" type="number" value={form.validityDays} onChange={v => setForm({ ...form, validityDays: v })} />
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={form.popular} onChange={e => setForm({ ...form, popular: e.target.checked })} /> Popular</label>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={form.recommended} onChange={e => setForm({ ...form, recommended: e.target.checked })} /> Recommended</label>
        <GoldButton onClick={save} className="sm:col-span-3"><span className="flex items-center justify-center gap-1"><Plus size={14} /> Create Plan</span></GoldButton>
      </GlassCard>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{plans.map(p => (
        <GlassCard key={p.id} className="p-3">
          <img src={p.image} className="h-24 w-full object-cover rounded-lg mb-2" />
          <div className="flex justify-between items-center"><div className="font-bold gold-text">{p.name}</div><Badge color={p.status === 'active' ? 'green' : 'red'}>{p.status}</Badge></div>
          <div className="text-xs text-white/60 mt-1">{p.category} · Invest {fmt(p.investAmount)} · Daily {fmt(p.dailyProfit)} · {p.validityDays}d · Total <span className="gold-text">{fmt(p.totalProfit)}</span></div>
          <div className="flex gap-1 flex-wrap mt-1">{p.featured && <Badge color="blue">Featured</Badge>}{p.popular && <Badge color="purple">Popular</Badge>}{p.recommended && <Badge color="gold">Recommended</Badge>}</div>
          <div className="flex gap-1 mt-2 flex-wrap">
            <button onClick={() => upd(p.id, { status: p.status === 'active' ? 'disabled' : 'active' })} className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10">{p.status === 'active' ? 'Disable' : 'Enable'}</button>
            <button onClick={() => upd(p.id, { featured: !p.featured })} className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10">Toggle Featured</button>
            <button onClick={() => dup(p.id)} className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10"><CopyIc size={11} className="inline" /> Duplicate</button>
            <button onClick={() => del(p.id)} className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300"><Trash2 size={11} className="inline" /></button>
          </div>
        </GlassCard>))}</div>
    </div>
  )
}

function AdminReferral() {
  const [s, setS] = useState(null)
  const [stats, setStats] = useState(null)
  const load = () => { api('settings').then(r => setS(r.settings)); api('admin/stats').then(setStats) }
  useEffect(() => { load() }, [])
  if (!s) return <div className="text-white/60">Loading…</div>
  const ref = s.referral || { levels: [10, 5, 2], maxLevels: 3, enabled: true, signupBonus: 0 }
  const setRef = (patch) => setS({ ...s, referral: { ...ref, ...patch } })
  const setLevel = (i, val) => {
    const levels = [...(ref.levels || [])]
    levels[i] = +val
    setRef({ levels })
  }
  const save = async () => {
    await api('settings', { method: 'PATCH', body: { referral: { ...ref, levels: ref.levels.map(x => +x) } } })
    toast.success('Referral settings saved — changes apply instantly')
    load()
  }
  return (
    <div className="space-y-3">
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3"><Network className="text-yellow-300" size={20} /><h3 className="font-bold text-lg gold-text">Referral / Team Management</h3></div>
        <p className="text-xs text-white/60 mb-4">Changes save directly to the database and apply to all future commission calculations — no code changes needed.</p>

        <Toggle checked={ref.enabled} onChange={v => setRef({ enabled: v })} label="Enable Referral System (master switch)" />

        <div className="mt-4">
          <h4 className="font-semibold text-sm mb-2">Commission Percentages</h4>
          <div className="grid sm:grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between mb-2"><Badge color={i === 0 ? 'gold' : i === 1 ? 'purple' : 'blue'}>Level {i + 1}</Badge></div>
                <div className="text-xs text-white/50 mb-1">Commission %</div>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.1" value={ref.levels?.[i] ?? 0} onChange={e => setLevel(i, e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-2xl font-bold gold-text" />
                  <span className="text-2xl gold-text">%</span>
                </div>
                <div className="text-[10px] text-white/40 mt-1">Paid to L{i + 1} upline on each daily profit collection</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-white/50 mb-1">Maximum Referral Levels</div>
            <input type="number" min="1" max={ref.levels?.length || 3} value={ref.maxLevels} onChange={e => setRef({ maxLevels: +e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <div className="text-[10px] text-white/40 mt-1">Levels to walk up the chain (max {ref.levels?.length || 3})</div>
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-xs text-white/50 mb-1">Signup Bonus (Bonus Wallet)</div>
            <input type="number" value={ref.signupBonus || 0} onChange={e => setRef({ signupBonus: +e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <div className="text-[10px] text-white/40 mt-1">Credited to bonus wallet for users who sign up via a referral link</div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20 text-xs text-white/70">
          <div className="font-semibold text-yellow-200 mb-1">Example calculation</div>
          When a user collects <span className="gold-text font-bold">$10</span> daily profit, their uplines receive:
          L1: <span className="text-green-300 font-bold">${((ref.levels?.[0] || 0) * 0.1).toFixed(2)}</span> ·
          L2: <span className="text-green-300 font-bold">${((ref.levels?.[1] || 0) * 0.1).toFixed(2)}</span> ·
          L3: <span className="text-green-300 font-bold">${((ref.levels?.[2] || 0) * 0.1).toFixed(2)}</span>
        </div>

        <GoldButton className="w-full mt-4 !py-3" onClick={save}><span className="flex items-center justify-center gap-2"><BadgeCheck size={16} /> Save Referral Settings</span></GoldButton>
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Trophy size={16} className="text-yellow-300" /> Top Referrers</h3>
        <div className="space-y-1">
          {(stats?.topReferrers || []).map((u, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/5">
              <span className="text-sm flex items-center gap-2"><Badge color={i === 0 ? 'gold' : i < 3 ? 'purple' : 'blue'}>#{i + 1}</Badge>{u.name}</span>
              <span className="text-sm gold-text font-bold">{fmt(u.referralIncome)}</span>
            </div>
          ))}
          {!stats?.topReferrers?.length && <div className="text-xs text-white/40">No referrers yet.</div>}
        </div>
      </GlassCard>
    </div>
  )
}

function AdminApprovals({ collection }) {
  const [items, setItems] = useState([])
  const load = () => api(collection).then(r => setItems(r.items))
  useEffect(() => { load() }, [collection])
  const act = async (id, a) => { await api(`${collection}/${id}/${a}`, { method: 'POST' }); load(); toast.success(a) }
  return (
    <GlassCard className="p-3 overflow-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-white/50 text-xs"><th className="text-left p-2">User ID</th><th>Amount</th>{collection === 'withdraws' && <><th>Method</th><th>Details</th></>}{collection === 'recharges' && <th>TX</th>}<th>Status</th><th></th></tr></thead>
        <tbody>{items.map(r => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="p-2 text-xs">{r.userId}</td>
            <td className="text-center font-bold gold-text">{fmt(r.amount)}</td>
            {collection === 'withdraws' && <><td className="text-center">{r.method}</td><td className="text-center text-xs">{r.details}</td></>}
            {collection === 'recharges' && <td className="text-center text-xs">{r.txId || '-'}</td>}
            <td className="text-center"><StatusBadge s={r.status} /></td>
            <td className="text-right space-x-1">{r.status === 'pending' && <><button onClick={() => act(r.id, 'approve')} className="px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs">Approve</button><button onClick={() => act(r.id, 'reject')} className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-xs">Reject</button></>}</td>
          </tr>))}</tbody>
      </table>
    </GlassCard>
  )
}

function AdminOrders() {
  const [orders, setOrders] = useState([])
  useEffect(() => { api('admin/orders').then(r => setOrders(r.orders)) }, [])
  return (
    <GlassCard className="p-3 overflow-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-white/50 text-xs"><th className="text-left p-2">Plan</th><th>Invest</th><th>Daily</th><th>Earned</th><th>Days</th><th>Status</th></tr></thead>
        <tbody>{orders.map(o => <tr key={o.id} className="border-t border-white/5"><td className="p-2">{o.planSnapshot.name}</td><td className="text-center">{fmt(o.planSnapshot.investAmount)}</td><td className="text-center">{fmt(o.planSnapshot.dailyProfit)}</td><td className="text-center text-green-300">{fmt(o.totalEarned)}</td><td className="text-center">{o.collectedDays}/{o.planSnapshot.validityDays}</td><td className="text-center"><StatusBadge s={o.status} /></td></tr>)}</tbody>
      </table>
    </GlassCard>
  )
}

function AdminGifts() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ code: '', reward: '', expiresAt: '', type: 'flat', wallet: 'main', usageLimit: 1, count: 1 })
  const load = () => api('gifts').then(r => setItems(r.items))
  useEffect(() => { load() }, [])
  const create = async () => { const r = await api('gifts', { method: 'POST', body: form }); setForm({ code: '', reward: '', expiresAt: '', type: 'flat', wallet: 'main', usageLimit: 1, count: 1 }); toast.success(`Created ${r.gifts.length} code(s)`); load() }
  return (
    <div className="space-y-3">
      <GlassCard className="p-4 grid sm:grid-cols-4 gap-2">
        <Input placeholder="Code (auto if empty + count>1)" value={form.code} onChange={v => setForm({ ...form, code: v.toUpperCase() })} />
        <Input placeholder="Reward (amount or %)" type="number" value={form.reward} onChange={v => setForm({ ...form, reward: v })} />
        <Select value={form.type} onChange={v => setForm({ ...form, type: v })} options={[{ value: 'flat', label: 'Flat amount' }, { value: 'percent', label: 'Percent of Main' }, { value: 'wallet', label: 'Wallet credit' }]} />
        <Select value={form.wallet} onChange={v => setForm({ ...form, wallet: v })} options={['main', 'profit', 'referral', 'bonus']} />
        <Input placeholder="Expiry (YYYY-MM-DD)" value={form.expiresAt} onChange={v => setForm({ ...form, expiresAt: v })} />
        <Input placeholder="Usage limit" type="number" value={form.usageLimit} onChange={v => setForm({ ...form, usageLimit: v })} />
        <Input placeholder="Bulk count" type="number" value={form.count} onChange={v => setForm({ ...form, count: v })} />
        <GoldButton onClick={create}>Generate</GoldButton>
      </GlassCard>
      <div className="grid sm:grid-cols-3 gap-2">{items.map(g => (
        <GlassCard key={g.id} className="p-3">
          <div className="flex justify-between"><span className="font-mono font-bold gold-text">{g.code}</span><span className="text-sm">{g.type === 'percent' ? `${g.reward}%` : fmt(g.reward)}</span></div>
          <div className="text-xs text-white/50 mt-1">{g.type} · {g.wallet} · {g.usedCount}/{g.usageLimit} used · {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : 'no expiry'}</div>
          <div className="flex gap-1 mt-2"><button onClick={async () => { await api(`gifts/${g.id}`, { method: 'PATCH', body: { disabled: !g.disabled } }); load() }} className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10">{g.disabled ? 'Enable' : 'Disable'}</button><button onClick={async () => { await api(`gifts/${g.id}`, { method: 'DELETE' }); load() }} className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300">Delete</button></div>
        </GlassCard>))}</div>
    </div>
  )
}

function AdminAnnounce() {
  const [s, setS] = useState(null); const [form, setForm] = useState({ title: '', message: '' })
  const load = () => api('settings').then(r => setS(r.settings))
  useEffect(() => { load() }, [])
  const add = async () => { await api('announcements', { method: 'POST', body: form }); setForm({ title: '', message: '' }); load() }
  const del = async (id) => { await api(`announcements/${id}`, { method: 'DELETE' }); load() }
  return (<div className="space-y-3"><GlassCard className="p-4 space-y-2"><Input placeholder="Title" value={form.title} onChange={v => setForm({ ...form, title: v })} /><Input placeholder="Message" value={form.message} onChange={v => setForm({ ...form, message: v })} /><GoldButton onClick={add}>Push Announcement</GoldButton></GlassCard>{(s?.announcements || []).map(a => <GlassCard key={a.id} className="p-3 flex justify-between"><div><div className="font-semibold">{a.title}</div><div className="text-sm text-white/60">{a.message}</div></div><button onClick={() => del(a.id)} className="text-red-300 text-xs">Delete</button></GlassCard>)}</div>)
}

function AdminCMS() {
  const [s, setS] = useState(null)
  const load = () => api('settings').then(r => setS(r.settings))
  useEffect(() => { load() }, [])
  const save = async (key, value) => { await api('settings', { method: 'PATCH', body: { pages: { ...(s.pages || {}), [key]: value } } }); toast.success('Saved'); load() }
  const saveFaq = async (faq) => { await api('settings', { method: 'PATCH', body: { faq } }); toast.success('Saved'); load() }
  if (!s) return null
  return (
    <div className="space-y-3">
      {['about', 'terms', 'privacy', 'refund', 'contact'].map(k => (
        <GlassCard key={k} className="p-4">
          <h3 className="font-semibold capitalize mb-2">{k} (HTML)</h3>
          <Textarea value={s.pages?.[k] || ''} onChange={v => setS({ ...s, pages: { ...s.pages, [k]: v } })} className="h-32 font-mono text-xs" />
          <GoldButton className="mt-2" onClick={() => save(k, s.pages[k])}>Save {k}</GoldButton>
        </GlassCard>
      ))}
      <GlassCard className="p-4"><h3 className="font-semibold mb-2">FAQ Editor</h3>{(s.faq || []).map((f, i) => (
        <div key={i} className="space-y-1 mb-2 p-2 bg-white/5 rounded-lg"><Input placeholder="Question" value={f.q} onChange={v => { const faq = [...s.faq]; faq[i].q = v; setS({ ...s, faq }) }} /><Input placeholder="Answer" value={f.a} onChange={v => { const faq = [...s.faq]; faq[i].a = v; setS({ ...s, faq }) }} /><div className="flex gap-2"><button onClick={() => { const faq = s.faq.filter((_, x) => x !== i); setS({ ...s, faq }); saveFaq(faq) }} className="text-xs text-red-300">Remove</button></div></div>
      ))}<div className="flex gap-2"><SoftButton onClick={() => setS({ ...s, faq: [...(s.faq || []), { q: '', a: '' }] })}>+ Add FAQ</SoftButton><GoldButton onClick={() => saveFaq(s.faq)}>Save All FAQs</GoldButton></div></GlassCard>
    </div>
  )
}

function AdminPaymentMethods() {
  const [s, setS] = useState(null)
  const load = () => api('settings').then(r => setS(r.settings))
  useEffect(() => { load() }, [])
  const save = async (paymentMethods) => { await api('settings', { method: 'PATCH', body: { paymentMethods } }); load(); toast.success('Saved') }
  if (!s) return null
  return (
    <div className="space-y-3">
      {(s.paymentMethods || []).map((pm, i) => (
        <GlassCard key={pm.id} className="p-3 grid sm:grid-cols-5 gap-2">
          <Select value={pm.type} onChange={v => { const a = [...s.paymentMethods]; a[i].type = v; setS({ ...s, paymentMethods: a }) }} options={['UPI', 'Bank', 'Crypto']} />
          <Input placeholder="Name" value={pm.name} onChange={v => { const a = [...s.paymentMethods]; a[i].name = v; setS({ ...s, paymentMethods: a }) }} />
          <Input placeholder="Details" value={pm.details} onChange={v => { const a = [...s.paymentMethods]; a[i].details = v; setS({ ...s, paymentMethods: a }) }} />
          <Input placeholder="QR image URL" value={pm.qrCode} onChange={v => { const a = [...s.paymentMethods]; a[i].qrCode = v; setS({ ...s, paymentMethods: a }) }} />
          <div className="flex items-center gap-1"><label className="text-xs flex items-center gap-1"><input type="checkbox" checked={pm.enabled !== false} onChange={e => { const a = [...s.paymentMethods]; a[i].enabled = e.target.checked; setS({ ...s, paymentMethods: a }) }} /> Enabled</label><button onClick={() => save(s.paymentMethods.filter(p => p.id !== pm.id))} className="text-red-300 text-xs ml-auto"><Trash2 size={12} /></button></div>
        </GlassCard>
      ))}
      <div className="flex gap-2"><SoftButton onClick={() => setS({ ...s, paymentMethods: [...(s.paymentMethods || []), { id: crypto.randomUUID(), type: 'UPI', name: '', details: '', qrCode: '', enabled: true }] })}>+ Add Method</SoftButton><GoldButton onClick={() => save(s.paymentMethods)}>Save All</GoldButton></div>
    </div>
  )
}

function AdminBanner() {
  const [s, setS] = useState(null)
  const load = () => api('settings').then(r => setS(r.settings))
  useEffect(() => { load() }, [])
  const save = async (bannerSlides) => { await api('settings', { method: 'PATCH', body: { bannerSlides } }); load(); toast.success('Saved') }
  const savePopup = async (popup) => { await api('settings', { method: 'PATCH', body: { popup } }); load(); toast.success('Saved') }
  if (!s) return null
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Banner Slides</h3>
      {(s.bannerSlides || []).map((b, i) => (
        <GlassCard key={b.id} className="p-3 grid sm:grid-cols-2 gap-2">
          <Input placeholder="Image URL" value={b.image} onChange={v => { const a = [...s.bannerSlides]; a[i].image = v; setS({ ...s, bannerSlides: a }) }} />
          <Input placeholder="Title" value={b.title} onChange={v => { const a = [...s.bannerSlides]; a[i].title = v; setS({ ...s, bannerSlides: a }) }} />
          <Input placeholder="Subtitle" value={b.subtitle} onChange={v => { const a = [...s.bannerSlides]; a[i].subtitle = v; setS({ ...s, bannerSlides: a }) }} />
          <Input placeholder="CTA text" value={b.ctaText} onChange={v => { const a = [...s.bannerSlides]; a[i].ctaText = v; setS({ ...s, bannerSlides: a }) }} />
          <Input placeholder="CTA link (plans|recharge|team)" value={b.ctaLink} onChange={v => { const a = [...s.bannerSlides]; a[i].ctaLink = v; setS({ ...s, bannerSlides: a }) }} />
          <button onClick={() => save(s.bannerSlides.filter(x => x.id !== b.id))} className="text-red-300 text-xs self-end">Delete slide</button>
        </GlassCard>
      ))}
      <div className="flex gap-2"><SoftButton onClick={() => setS({ ...s, bannerSlides: [...(s.bannerSlides || []), { id: crypto.randomUUID(), image: '', title: '', subtitle: '', ctaText: '', ctaLink: 'plans' }] })}>+ Add Slide</SoftButton><GoldButton onClick={() => save(s.bannerSlides)}>Save All</GoldButton></div>

      <h3 className="font-semibold mt-4">Welcome Popup</h3>
      <GlassCard className="p-3 space-y-2">
        <Toggle checked={s.popup?.enabled} onChange={v => setS({ ...s, popup: { ...s.popup, enabled: v } })} label="Show popup on home" />
        <Input placeholder="Title" value={s.popup?.title} onChange={v => setS({ ...s, popup: { ...s.popup, title: v } })} />
        <Input placeholder="Message" value={s.popup?.message} onChange={v => setS({ ...s, popup: { ...s.popup, message: v } })} />
        <Input placeholder="Image URL" value={s.popup?.image} onChange={v => setS({ ...s, popup: { ...s.popup, image: v } })} />
        <Input placeholder="CTA Text" value={s.popup?.ctaText} onChange={v => setS({ ...s, popup: { ...s.popup, ctaText: v } })} />
        <Input placeholder="CTA Link" value={s.popup?.ctaLink} onChange={v => setS({ ...s, popup: { ...s.popup, ctaLink: v } })} />
        <GoldButton onClick={() => savePopup(s.popup)}>Save Popup</GoldButton>
      </GlassCard>

      <h3 className="font-semibold mt-4">Investment Disclaimer</h3>
      <GlassCard className="p-3 space-y-2">
        <Toggle checked={s.disclaimer?.enabled} onChange={v => setS({ ...s, disclaimer: { ...s.disclaimer, enabled: v } })} label="Show disclaimer on home (one-time per user)" />
        <Input placeholder="Title" value={s.disclaimer?.title} onChange={v => setS({ ...s, disclaimer: { ...s.disclaimer, title: v } })} />
        <Textarea placeholder="Disclaimer message" value={s.disclaimer?.message} onChange={v => setS({ ...s, disclaimer: { ...s.disclaimer, message: v } })} className="h-28" />
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="Accept button text" value={s.disclaimer?.acceptText} onChange={v => setS({ ...s, disclaimer: { ...s.disclaimer, acceptText: v } })} />
          <Input placeholder="View Terms button text" value={s.disclaimer?.viewTermsText} onChange={v => setS({ ...s, disclaimer: { ...s.disclaimer, viewTermsText: v } })} />
          <Input placeholder="Accent color (#hex)" value={s.disclaimer?.color} onChange={v => setS({ ...s, disclaimer: { ...s.disclaimer, color: v } })} />
        </div>
        <div className="flex gap-2">
          <GoldButton onClick={async () => { await api('settings', { method: 'PATCH', body: { disclaimer: s.disclaimer } }); toast.success('Disclaimer saved'); load() }}>Save Disclaimer</GoldButton>
          <SoftButton onClick={() => { localStorage.removeItem('ib_disclaimer_accepted_v1'); toast.success('Disclaimer reset — next home visit will show it') }}>Reset on this device</SoftButton>
        </div>
      </GlassCard>
    </div>
  )
}

function AdminTestimonials() {
  const [s, setS] = useState(null)
  const load = () => api('settings').then(r => setS(r.settings))
  useEffect(() => { load() }, [])
  const save = async (testimonials) => { await api('settings', { method: 'PATCH', body: { testimonials } }); load(); toast.success('Saved') }
  if (!s) return null
  return (
    <div className="space-y-3">
      {(s.testimonials || []).map((t, i) => (
        <GlassCard key={t.id} className="p-3 grid sm:grid-cols-2 gap-2">
          <Input placeholder="Name" value={t.name} onChange={v => { const a = [...s.testimonials]; a[i].name = v; setS({ ...s, testimonials: a }) }} />
          <Input placeholder="Role" value={t.role} onChange={v => { const a = [...s.testimonials]; a[i].role = v; setS({ ...s, testimonials: a }) }} />
          <Input placeholder="Rating (1-5)" type="number" value={t.rating} onChange={v => { const a = [...s.testimonials]; a[i].rating = +v; setS({ ...s, testimonials: a }) }} />
          <Input placeholder="Avatar URL" value={t.avatar} onChange={v => { const a = [...s.testimonials]; a[i].avatar = v; setS({ ...s, testimonials: a }) }} />
          <Textarea placeholder="Quote" value={t.text} onChange={v => { const a = [...s.testimonials]; a[i].text = v; setS({ ...s, testimonials: a }) }} className="sm:col-span-2 h-20" />
          <button onClick={() => save(s.testimonials.filter(x => x.id !== t.id))} className="text-red-300 text-xs sm:col-span-2 text-left">Delete</button>
        </GlassCard>
      ))}
      <div className="flex gap-2"><SoftButton onClick={() => setS({ ...s, testimonials: [...(s.testimonials || []), { id: crypto.randomUUID(), name: '', role: '', text: '', rating: 5, avatar: '' }] })}>+ Add</SoftButton><GoldButton onClick={() => save(s.testimonials)}>Save All</GoldButton></div>
    </div>
  )
}

function AdminSettings() {
  const [s, setS] = useState(null)
  const load = () => api('settings').then(r => setS(r.settings))
  useEffect(() => { load() }, [])
  const save = async (patch) => { await api('settings', { method: 'PATCH', body: patch }); toast.success('Saved'); load() }
  if (!s) return null
  const Num = ({ k, label, group }) => (
    <div><div className="text-xs text-white/50">{label}</div><input type="number" defaultValue={group ? s[group][k] : s[k]} onBlur={e => save(group ? { [group]: { ...s[group], [k]: +e.target.value } } : { [k]: +e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" /></div>
  )
  const Txt = ({ k, label, group }) => (
    <div><div className="text-xs text-white/50">{label}</div><input defaultValue={group ? s[group][k] : s[k]} onBlur={e => save(group ? { [group]: { ...s[group], [k]: e.target.value } } : { [k]: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" /></div>
  )
  return (
    <div className="space-y-3">
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">Site</h3><div className="grid sm:grid-cols-2 gap-2"><Txt k="siteName" label="Site Name" /><Txt k="timezone" label="Timezone" /><Txt k="language" label="Language" /><Txt k="logo" label="Logo URL" /><Txt k="favicon" label="Favicon URL" /></div>
        <div className="grid sm:grid-cols-2 gap-2"><Txt k="code" label="Currency Code" group="currency" /><Txt k="symbol" label="Currency Symbol" group="currency" /></div>
        <Toggle checked={s.maintenanceMode} onChange={v => save({ maintenanceMode: v })} label="Maintenance Mode" />
        <Input placeholder="Maintenance message" value={s.maintenanceMessage} onChange={v => save({ maintenanceMessage: v })} />
      </GlassCard>
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">SEO</h3><div className="grid sm:grid-cols-2 gap-2"><Txt k="metaTitle" label="Meta Title" group="seo" /><Txt k="metaDescription" label="Meta Description" group="seo" /><Txt k="ogImage" label="OG Image URL" group="seo" /></div></GlassCard>
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">Theme Colors</h3><div className="grid sm:grid-cols-2 gap-2"><Txt k="primary" label="Primary (hex)" group="themeColors" /><Txt k="secondary" label="Secondary (hex)" group="themeColors" /></div></GlassCard>
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">Daily Collection</h3><Num k="collectionIntervalHours" label="Interval Hours (default 24)" /><Toggle checked={s.collectEnabled} onChange={v => save({ collectEnabled: v })} label="Collection Enabled" /><Toggle checked={s.autoExpireEnabled} onChange={v => save({ autoExpireEnabled: v })} label="Auto-Expire Completed Plans" /></GlassCard>
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">Referral System</h3>
        <Toggle checked={s.referral.enabled} onChange={v => save({ referral: { ...s.referral, enabled: v } })} label="Referral Enabled" />
        <Num k="maxLevels" label="Max Levels" group="referral" />
        <Num k="signupBonus" label="Signup Bonus" group="referral" />
        <div><div className="text-xs text-white/50">Level Percentages (comma-separated)</div><input defaultValue={(s.referral.levels || []).join(',')} onBlur={e => save({ referral: { ...s.referral, levels: e.target.value.split(',').map(x => +x.trim()).filter(x => !isNaN(x)) } })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" /></div>
      </GlassCard>
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">Recharge</h3>
        <Toggle checked={s.rechargeEnabled} onChange={v => save({ rechargeEnabled: v })} label="Recharge Enabled" />
        <Toggle checked={s.autoApproveRecharge} onChange={v => save({ autoApproveRecharge: v })} label="Auto-approve Recharges" />
        <div className="grid grid-cols-2 gap-2"><Num k="minRecharge" label="Min Recharge" /><Num k="maxRecharge" label="Max Recharge" /></div>
      </GlassCard>
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">Withdraw</h3>
        <Toggle checked={s.withdrawEnabled} onChange={v => save({ withdrawEnabled: v })} label="Withdraw Enabled" />
        <div className="grid grid-cols-2 gap-2"><Num k="minWithdraw" label="Min" /><Num k="maxWithdraw" label="Max" /><Num k="dailyWithdrawLimit" label="Daily Limit" /><Num k="withdrawFeePct" label="Fee %" /><Num k="processingTimeHours" label="Processing Time (h)" /></div>
      </GlassCard>
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">Features</h3><Toggle checked={s.giftEnabled} onChange={v => save({ giftEnabled: v })} label="Gift Code Enabled" /><Toggle checked={s.registrationEnabled} onChange={v => save({ registrationEnabled: v })} label="Registration Enabled" /></GlassCard>
      <GlassCard className="p-4 space-y-2"><h3 className="font-semibold">Contact & Social</h3><div className="grid sm:grid-cols-2 gap-2"><Txt k="email" label="Email" group="contact" /><Txt k="phone" label="Phone" group="contact" /><Txt k="telegram" label="Telegram" group="contact" /><Txt k="whatsapp" label="WhatsApp" group="contact" /><Txt k="address" label="Address" group="contact" /></div></GlassCard>
    </div>
  )
}

function AdminLogs() {
  const [items, setItems] = useState([])
  useEffect(() => { api('admin/login-logs').then(r => setItems(r.items)) }, [])
  return (
    <GlassCard className="p-3 overflow-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-white/50 text-xs"><th className="text-left p-2">User ID</th><th>Event</th><th>IP</th><th>User Agent</th><th>Time</th></tr></thead>
        <tbody>{items.map(l => <tr key={l.id} className="border-t border-white/5"><td className="p-2 text-xs">{l.userId}</td><td className="text-center"><Badge color={l.event === 'login' ? 'green' : 'blue'}>{l.event}</Badge></td><td className="text-center text-xs">{l.ip}</td><td className="text-xs max-w-xs truncate">{l.ua}</td><td className="text-xs text-white/50">{new Date(l.at).toLocaleString()}</td></tr>)}</tbody>
      </table>
    </GlassCard>
  )
}

// ============ Bottom Nav ============
function BottomNav({ active, onChange }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="max-w-md mx-auto m-3 glass-strong rounded-2xl p-1.5 flex">{[['home', Home, 'Home'], ['plans', Layers, 'Plans'], ['team', Users, 'Team'], ['mine', User, 'Mine']].map(([k, Ic, l]) => <button key={k} onClick={() => onChange(k)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs transition ${active === k ? 'gold-btn !shadow-none' : 'text-white/70'}`}><Ic size={18} /> {l}</button>)}</div>
    </div>
  )
}

// ============ App Root ============
function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState('home')
  const [plans, setPlans] = useState([])
  const [settings, setSettings] = useState(null)
  const [adminMode, setAdminMode] = useState(false)
  const [boot, setBoot] = useState(true)

  const refresh = async () => {
    try { const r = await api('me'); setUser(r.user) } catch {}
    try { const r = await api('plans'); setPlans(r.plans) } catch {}
    try { const r = await api('settings'); setSettings(r.settings); if (r.settings?.currency) CURRENCY = r.settings.currency } catch {}
  }
  useEffect(() => {
    api('settings').then(r => { setSettings(r.settings); if (r.settings?.currency) CURRENCY = r.settings.currency })
    const token = localStorage.getItem('ib_token')
    if (token) refresh().finally(() => setBoot(false)); else setBoot(false)
  }, [])
  const handleAuth = (u) => { setUser(u); refresh() }
  const logout = () => { localStorage.removeItem('ib_token'); setUser(null); setView('home'); setAdminMode(false) }
  const buyPlan = async (plan) => {
    const total = (user.wallets?.main || 0) + (user.wallets?.profit || 0) + (user.wallets?.referral || 0) + (user.wallets?.bonus || 0)
    if (total < plan.investAmount) {
      toast.error(`Insufficient balance. You have ${fmt(total)} total. Please recharge.`)
      return
    }
    if (!await askConfirm(`Invest <b>${fmt(plan.investAmount)}</b> in <span style="color:#fbe089">${plan.name}</span>?<br/><br/><span style="opacity:.7;font-size:.8rem">Amount will be deducted from your wallets in order: Main → Bonus → Profit → Referral</span>`)) return
    try { await api('orders', { method: 'POST', body: { planId: plan.id } }); toast.success('Investment successful! Check Orders to collect daily profit.'); await refresh(); setView('orders') } catch (e) { toast.error(e.message) }
  }

  if (boot) return <div className="min-h-screen aurora flex items-center justify-center"><div className="shimmer w-40 h-3 rounded-full" /></div>
  if (settings?.maintenanceMode && (!user || user.role !== 'admin')) return <div className="min-h-screen aurora flex items-center justify-center p-4 text-center"><div><Crown size={48} className="text-yellow-300 mx-auto mb-4" /><h1 className="text-3xl font-bold gold-text">{settings.siteName}</h1><p className="text-white/70 mt-4 max-w-md">{settings.maintenanceMessage}</p></div></div>
  if (!user) return <AuthScreen onAuth={handleAuth} settings={settings} />
  if (adminMode && user.role === 'admin') return <AdminPanel user={user} onExit={() => setAdminMode(false)} refresh={refresh} />

  return (
    <div className="min-h-screen aurora">
      <Header user={user} settings={settings} onLogout={logout} onSwitch={() => setAdminMode(true)} onNav={setView} />
      <main className="max-w-6xl mx-auto px-4 py-4">
        {view === 'home' && <HomePage settings={settings} plans={plans} onNav={setView} />}
        {view === 'plans' && <PlansPage plans={plans} onBuy={buyPlan} />}
        {view === 'team' && <TeamPage />}
        {view === 'mine' && <MinePage user={user} onNav={setView} onLogout={logout} />}
        {view === 'orders' && <OrdersPage refresh={refresh} />}
        {view === 'recharge' && <RechargePage settings={settings} refresh={refresh} />}
        {view === 'withdraw' && <WithdrawPage user={user} settings={settings} refresh={refresh} />}
        {view === 'transfer' && <TransferPage user={user} refresh={refresh} />}
        {view === 'gift' && <GiftPage refresh={refresh} />}
        {view === 'history' && <HistoryPage />}
        {view === 'bank' && <BankPage user={user} refresh={refresh} />}
        {view === 'password' && <PasswordPage />}
        {view === 'about' && <CMSPage settings={settings} page="about" />}
        {view === 'terms' && <CMSPage settings={settings} page="terms" />}
        {view === 'privacy' && <CMSPage settings={settings} page="privacy" />}
        {view === 'refund' && <CMSPage settings={settings} page="refund" />}
        {view === 'contact' && <CMSPage settings={settings} page="contact" />}
        {view === 'support' && <SupportPage />}
        {view === 'notifications' && <NotificationsPage settings={settings} />}
      </main>
      <BottomNav active={['home', 'plans', 'team', 'mine'].includes(view) ? view : 'home'} onChange={setView} />
    </div>
  )
}

export default App
