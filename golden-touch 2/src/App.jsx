import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, CheckCircle2, ChevronRight, CircleUserRound, ClipboardList,
  Heart, LogOut, Menu, Minus, Package, Phone, Plus,
  Search, ShieldCheck, ShoppingBag, Sparkles, Trash2, Truck, X,
} from 'lucide-react'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase, ADMIN_EMAIL } from './supabase'

const DEFAULT_SETTINGS = {
  store_name: 'Golden Touch',
  contact_phone: '01990941408',
  whatsapp_number: '8801990941408',
  delivery_charge: 30,
  currency: 'BDT',
}

const STATUS_OPTIONS = [
  'pending', 'confirmed', 'processing', 'packed', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled',
]

const money = (amount) => `৳${Number(amount || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })}`
const dateTime = (value) => value ? new Date(value).toLocaleString('en-BD') : '—'
const shortId = (value) => value ? String(value).slice(0, 8).toUpperCase() : '—'

async function ensureCustomerSession() {
  if (!supabase) throw new Error('The store connection is not configured yet.')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (data?.session) return data.session
  const { data: guestData, error: guestError } = await supabase.auth.signInAnonymously()
  if (guestError) {
    throw new Error('Guest checkout চালু নেই। Supabase Authentication থেকে Anonymous Sign-ins Enable করুন। ' + guestError.message)
  }
  if (!guestData?.session) throw new Error('Could not start a guest session. Please try again.')
  return guestData.session
}

function useAuthSession() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return undefined
    }
    let alive = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) console.error('Could not restore Supabase session:', error.message)
      setSession(data?.session || null)
      setReady(true)
    }).catch((error) => {
      if (alive) {
        console.error('Could not restore Supabase session:', error)
        setReady(true)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null)
      setReady(true)
    })
    return () => {
      alive = false
      data?.subscription?.unsubscribe()
    }
  }, [])
  return { session, ready }
}

function App() {
  const { session, ready: authReady } = useAuthSession()
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gt_cart') || '[]') } catch { return [] }
  })
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    localStorage.setItem('gt_cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    let active = true
    async function loadStore() {
      if (!supabase) {
        setLoading(false)
        return
      }
      setLoading(true)
      const [productResult, settingsResult] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('store_settings_legacy').select('*').eq('id', 1).maybeSingle(),
      ])
      if (!active) return
      if (!productResult.error) setProducts(productResult.data || [])
      if (settingsResult.data) setSettings({ ...DEFAULT_SETTINGS, ...settingsResult.data })
      setLoading(false)
    }
    loadStore()
    return () => { active = false }
  }, [])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => {
      const matchesSearch = !query || `${product.name || ''} ${product.category || ''} ${product.description || ''}`.toLowerCase().includes(query)
      const matchesCategory = categoryFilter === 'All' || String(product.category || '').toLowerCase().includes(categoryFilter.toLowerCase())
      return matchesSearch && matchesCategory
    })
  }, [products, search, categoryFilter])

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) return current.map((item) => item.id === product.id
        ? { ...item, qty: Math.min(Number(product.stock || 99), item.qty + 1) }
        : item)
      return [...current, { ...product, qty: 1 }]
    })
  }

  const updateQuantity = (id, quantity) => {
    setCart((current) => quantity <= 0
      ? current.filter((item) => item.id !== id)
      : current.map((item) => item.id === id ? { ...item, qty: Math.min(Number(item.stock || 99), quantity) } : item))
  }

  const cartCount = cart.reduce((total, item) => total + Number(item.qty || 0), 0)

  if (!supabase) return <SetupRequired />

  return (
    <div className="gt-app">
      <style>{APP_STYLES}</style>
      <div className="gt-utility-bar">
        <span>BEAUTY · CARE · CONFIDENCE</span>
        <span>Need help? <a href={`tel:${settings.contact_phone || DEFAULT_SETTINGS.contact_phone}`}>{settings.contact_phone || DEFAULT_SETTINGS.contact_phone}</a></span>
        <span>Cash on delivery available</span>
      </div>
      <header className="gt-header gt-retail-header">
        <Link to="/" className="gt-brand" onClick={() => { setMobileMenu(false); setCategoryFilter('All') }}>
          <img className="gt-brand-logo" src={`${import.meta.env.BASE_URL}golden-touch-logo.jpeg`} alt="Golden Touch logo" />
          <span><strong>GOLDEN TOUCH</strong><small>BEAUTY · CARE · CONFIDENCE</small></span>
        </Link>
        <div className="gt-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search beauty products..." aria-label="Search products" /></div>
        <nav className={`gt-nav ${mobileMenu ? 'is-open' : ''}`}>
          <NavLink to="/" end onClick={() => setMobileMenu(false)}>Home</NavLink>
          <a href={`${import.meta.env.BASE_URL}#categories`} onClick={() => setMobileMenu(false)}>Categories</a>
          <a href={`${import.meta.env.BASE_URL}#shop`} onClick={() => setMobileMenu(false)}>Shop</a>
          <NavLink to="/track" onClick={() => setMobileMenu(false)}>Track order</NavLink>
        </nav>
        <div className="gt-head-actions">
          <Link to="/account" className="gt-account-link"><CircleUserRound size={18} /><span>Account</span></Link>
          <Link to="/cart" className="gt-cart-link" aria-label={`Cart, ${cartCount} items`}><ShoppingBag size={19} /><span>Cart</span><b>{cartCount}</b></Link>
          <button className="gt-menu-button" onClick={() => setMobileMenu((value) => !value)} aria-label="Toggle menu">{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </header>
      <nav className="gt-category-ribbon" aria-label="Shop categories">
        <button className={categoryFilter === 'All' ? 'active' : ''} onClick={() => { setCategoryFilter('All'); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }) }}>ALL COLLECTION</button>
        {['Makeup', 'Skincare', 'Hair Care', 'Bath & Body', 'Perfume', 'Beauty Tools', 'Fashion'].map((category) => <button key={category} className={categoryFilter === category ? 'active' : ''} onClick={() => { setCategoryFilter(category); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }) }}>{category.toUpperCase()}</button>)}
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Home products={filteredProducts} loading={loading} addToCart={addToCart} settings={settings} categoryFilter={categoryFilter} onCategoryChange={setCategoryFilter} />} />
          <Route path="/cart" element={<CartPage cart={cart} updateQuantity={updateQuantity} settings={settings} />} />
          <Route path="/checkout" element={<Checkout cart={cart} setCart={setCart} settings={settings} />} />
          <Route path="/account" element={<Account session={session} authReady={authReady} />} />
          <Route path="/orders" element={<Orders session={session} authReady={authReady} />} />
          <Route path="/track" element={<TrackOrder />} />
          <Route path="/admin/*" element={<Admin session={session} authReady={authReady} products={products} refreshProducts={() => supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }).then(({ data }) => setProducts(data || []))} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer settings={settings} />
    </div>
  )
}

const STORE_CATEGORIES = [
  { name: 'Makeup', note: 'Makeup & everyday essentials', icon: '💄' },
  { name: 'Skincare', note: 'Scrubs, care & a healthy glow', icon: '🧴' },
  { name: 'Hair Care', note: 'Care for every hair day', icon: '💆🏻‍♀️' },
  { name: 'Bath & Body', note: 'Feel-good body care', icon: '🫧' },
  { name: 'Perfume', note: 'Find your signature scent', icon: '🌸' },
  { name: 'Beauty Tools', note: 'Tools for your beauty routine', icon: '🪞' },
  { name: 'Fashion', note: 'Style, accessories & more', icon: '👗' },
]

function Home({ products, loading, addToCart, settings, categoryFilter, onCategoryChange }) {
  const newest = [...products].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  return (
    <>
      <section className="gt-luxe-hero">
        <div className="gt-luxe-hero-copy">
          <div className="gt-luxe-kicker"><Sparkles size={14} /> A LITTLE LUXURY, EVERY DAY</div>
          <h1>Beauty begins<br />with <em>your glow.</em></h1>
          <p>Discover beauty, skincare and personal-care favourites, thoughtfully brought together by Golden Touch.</p>
          <div className="gt-luxe-hero-actions">
            <a className="gt-button gt-button-gold" href="#shop">Explore the collection <ArrowRight size={16} /></a>
            <a className="gt-hero-link" href="#categories">Browse categories <ChevronRight size={16} /></a>
          </div>
          <div className="gt-luxe-assurances"><span><ShieldCheck size={16} /> Easy guest checkout</span><i /> <span><Truck size={16} /> Delivery support</span></div>
        </div>
        <div className="gt-luxe-hero-art">
          <div className="gt-hero-orbit orbit-one" /><div className="gt-hero-orbit orbit-two" />
          <div className="gt-hero-logo-frame"><img src={`${import.meta.env.BASE_URL}golden-touch-logo.jpeg`} alt="Golden Touch — Where queens are crowned" /></div>
          <div className="gt-hero-floating-card"><Sparkles size={16} /><span><b>Golden Touch</b><small>Beauty · Confidence · Elegance</small></span></div>
          <div className="gt-hero-side-note">YOUR BEAUTY, YOUR MOMENT</div>
        </div>
      </section>

      <section className="gt-luxe-benefits" aria-label="Store benefits">
        <div><span className="gt-benefit-icon">✦</span><span><b>Thoughtfully selected</b><small>Beauty favourites</small></span></div>
        <div><span className="gt-benefit-icon">♡</span><span><b>Order with ease</b><small>Guest checkout available</small></span></div>
        <div><span className="gt-benefit-icon">৳</span><span><b>Flexible payment</b><small>COD · bKash · Nagad</small></span></div>
        <div><span className="gt-benefit-icon">☎</span><span><b>Personal support</b><small>{settings.contact_phone || DEFAULT_SETTINGS.contact_phone}</small></span></div>
      </section>

      <section className="gt-luxe-categories" id="categories">
        <div className="gt-luxe-section-heading"><div><div className="gt-eyebrow">EXPLORE GOLDEN TOUCH</div><h2>Shop by category</h2><p>Find the little things that make you feel your best.</p></div><span>BEAUTY · CARE · STYLE</span></div>
        <div className="gt-category-grid">
          {STORE_CATEGORIES.map((category, index) => <button type="button" key={category.name} className={`gt-category-tile category-tone-${index + 1} ${categoryFilter === category.name ? 'selected' : ''}`} onClick={() => { onCategoryChange(category.name); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }) }}>
            <span className="gt-category-icon">{category.icon}</span><b>{category.name}</b><small>{category.note}</small><span className="gt-category-arrow"><ArrowRight size={15} /></span>
          </button>)}
        </div>
      </section>

      <section className="gt-luxe-promo-row">
        <article className="gt-promo-card gt-promo-dark"><div><span>THE GOLDEN EDIT</span><h3>Make time<br />for yourself.</h3><a href="#shop">Discover favourites <ArrowRight size={15} /></a></div><div className="gt-promo-flower">✿</div></article>
        <article className="gt-promo-card gt-promo-light"><div><span>VISIT OUR PARLOUR</span><h3>Your moment<br />to feel special.</h3><a href="#why-us">Discover Golden Touch <ArrowRight size={15} /></a></div><div className="gt-promo-sparkle">✧</div></article>
      </section>

      <section className="gt-section gt-luxe-products" id="shop">
        <div className="gt-luxe-section-heading"><div><div className="gt-eyebrow">THE GOLDEN COLLECTION</div><h2>{categoryFilter === 'All' ? 'Featured products' : categoryFilter}</h2><p>Explore our current collection, selected with care.</p></div><span className="gt-muted-count">{loading ? '...' : `${products.length} products`}</span></div>
        <div className="gt-product-filters"><button className={categoryFilter === 'All' ? 'active' : ''} onClick={() => onCategoryChange('All')}>All products</button><button className={categoryFilter === 'Skincare' ? 'active' : ''} onClick={() => onCategoryChange('Skincare')}>Skincare</button></div>
        {loading ? <div className="gt-empty">Loading our collection...</div> : products.length ? <div className="gt-product-grid">{(categoryFilter === 'All' ? newest : products).map((product) => <ProductCard key={product.id} product={product} addToCart={addToCart} />)}</div> : <div className="gt-empty-panel gt-no-products"><Sparkles size={28} /><h3>More lovely finds are on the way</h3><p>There are no products in this category yet. Browse our current collection instead.</p><button className="gt-button gt-button-gold" onClick={() => onCategoryChange('All')}>View all products</button></div>}
      </section>

      <section className="gt-why gt-luxe-why" id="why-us"><div className="gt-eyebrow">A GOLDEN TOUCH DIFFERENCE</div><h2>Confidence looks <em>beautiful on you.</em></h2><p className="gt-luxe-why-intro">More than products, we want every visit and every order to feel personal.</p><div className="gt-why-grid"><article><Heart /><h3>Care in every detail</h3><p>We believe beauty should feel personal, easy and joyful.</p></article><article><ShieldCheck /><h3>Checkout made simple</h3><p>Order as a guest. Create an account only if you want to.</p></article><article><Phone /><h3>Here to help</h3><p>Questions? Reach out for friendly support.</p><a href={`https://wa.me/${String(settings.whatsapp_number || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Chat with us <ArrowRight size={15} /></a></article></div></section>
    </>
  )
}

function ProductCard({ product, addToCart }) {
  const outOfStock = Number(product.stock || 0) <= 0
  return (
    <article className="gt-product-card">
      <div className="gt-product-image">
        {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <div className="gt-product-placeholder"><Sparkles size={34} /><span>GOLDEN TOUCH</span></div>}
        <span className="gt-product-category">{product.category || 'Beauty'}</span>
      </div>
      <div className="gt-product-details"><h3>{product.name}</h3><p>{product.description || 'A Golden Touch favourite.'}</p><div className="gt-product-bottom"><strong>{money(product.price)}</strong><button disabled={outOfStock} onClick={() => addToCart(product)}>{outOfStock ? 'Out of stock' : <><Plus size={16} /> Add</>}</button></div></div>
    </article>
  )
}

function CartPage({ cart, updateQuantity, settings }) {
  const navigate = useNavigate()
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0)
  const delivery = Number(settings.delivery_charge || 0)
  return <section className="gt-page"><PageHeading eyebrow="YOUR BAG" title="Shopping cart" subtitle="Review your items before checkout." />
    {!cart.length ? <div className="gt-empty-panel"><ShoppingBag size={42} /><h2>Your cart is waiting</h2><p>Find something lovely in our collection.</p><Link className="gt-button gt-button-gold" to="/">Continue shopping</Link></div> :
      <div className="gt-cart-layout"><div className="gt-cart-items">{cart.map((item) => <div className="gt-cart-item" key={item.id}><div className="gt-cart-thumb">{item.image_url ? <img src={item.image_url} alt="" /> : <Sparkles />}</div><div className="gt-cart-item-info"><b>{item.name}</b><span>{money(item.price)} each</span><div className="gt-quantity"><button onClick={() => updateQuantity(item.id, item.qty - 1)} aria-label="Decrease quantity"><Minus size={14} /></button><b>{item.qty}</b><button onClick={() => updateQuantity(item.id, item.qty + 1)} aria-label="Increase quantity"><Plus size={14} /></button></div></div><strong>{money(item.price * item.qty)}</strong><button className="gt-icon-button" onClick={() => updateQuantity(item.id, 0)} aria-label="Remove item"><Trash2 size={17} /></button></div>)}</div>
        <OrderSummary subtotal={subtotal} delivery={delivery} action={<button className="gt-button gt-button-gold gt-full" onClick={() => navigate('/checkout')}>Proceed to checkout <ArrowRight size={16} /></button>} />
      </div>}
  </section>
}

function OrderSummary({ subtotal, delivery, action }) {
  return <aside className="gt-summary"><h3>Order summary</h3><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Delivery</span><b>{money(delivery)}</b></div><div className="gt-summary-total"><span>Total</span><b>{money(subtotal + delivery)}</b></div>{action}<p>No account required. You can checkout as a guest.</p></aside>
}

function Checkout({ cart, setCart, settings }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ customer_name: '', phone: '', address: '', payment_method: 'COD', transaction_id: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0)
  const delivery = Number(settings.delivery_charge || 0)
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!cart.length) return setError('Your cart is empty.')
    setBusy(true)
    try {
      await ensureCustomerSession()
      const { data, error: invokeError } = await supabase.functions.invoke('checkout', {
        body: {
          p_customer_name: form.customer_name.trim(),
          p_phone: form.phone.trim(),
          p_division: '',
          p_district: '',
          p_address: form.address.trim(),
          p_payment_method: form.payment_method,
          p_transaction_id: form.transaction_id.trim(),
          p_notes: form.notes.trim(),
          p_items: cart.map(({ id, qty }) => ({ product_id: id, quantity: qty })),
        },
      })
      if (invokeError) throw invokeError
      if (!data?.success || !data?.order?.tracking_code) throw new Error(data?.error || 'Could not place order. Please try again.')
      setSuccess({ trackingCode: data.order.tracking_code, total: data.order.total || subtotal + delivery })
      setCart([])
    } catch (submitError) {
      setError(submitError.message || 'Could not place order. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (success) return <section className="gt-page gt-narrow"><div className="gt-success-panel"><div className="gt-success-icon"><CheckCircle2 size={38} /></div><div className="gt-eyebrow">ORDER RECEIVED</div><h1>Thank you!</h1><p>Your order has been placed successfully.</p><div className="gt-tracking-code"><span>Your tracking code</span><strong>{success.trackingCode}</strong></div><p className="gt-small-note">Save your tracking code and phone number to check your order status.</p><Link className="gt-button gt-button-gold" to="/track">Track your order <ArrowRight size={16} /></Link><Link className="gt-text-link" to="/">Continue shopping</Link></div></section>

  if (!cart.length) return <section className="gt-page gt-narrow"><div className="gt-empty-panel"><ShoppingBag size={40} /><h2>Your cart is empty</h2><Link className="gt-button gt-button-gold" to="/">Explore products</Link></div></section>

  return <section className="gt-page"><PageHeading eyebrow="ALMOST THERE" title="Checkout" subtitle="Guest checkout is available. No account or password needed." />
    <div className="gt-cart-layout"><form className="gt-form-card" onSubmit={submit}>
      <h2>Delivery details</h2>
      <label>Full name<input name="customer_name" value={form.customer_name} onChange={change} placeholder="Your name" autoComplete="name" required /></label>
      <label>Mobile number<input name="phone" value={form.phone} onChange={change} placeholder="01XXXXXXXXX" inputMode="tel" autoComplete="tel" required minLength={10} /></label>
      <label>Delivery address<textarea name="address" value={form.address} onChange={change} placeholder="House, road, area, district" required rows={3} /></label>
      <label>Payment method<select name="payment_method" value={form.payment_method} onChange={change}><option value="COD">Cash on delivery</option><option value="BKASH">bKash (manual)</option><option value="NAGAD">Nagad (manual)</option></select></label>
      {form.payment_method !== 'COD' && <label>Payment transaction/reference ID<input name="transaction_id" value={form.transaction_id} onChange={change} placeholder="bKash/Nagad Transaction ID" required /></label>}
      <label>Order note (optional)<textarea name="notes" value={form.notes} onChange={change} placeholder="Any delivery instructions" rows={2} /></label>
      {error && <div className="gt-error" role="alert">{error}</div>}
      <button className="gt-button gt-button-gold gt-full" type="submit" disabled={busy}>{busy ? 'Placing order…' : <>Place order · {money(subtotal + delivery)} <ArrowRight size={16} /></>}</button>
      <p className="gt-small-note">Your order will be validated against the current product price and stock before it is accepted.</p>
    </form>
    <aside className="gt-summary"><h3>Your order</h3>{cart.map((item) => <div key={item.id}><span>{item.name} × {item.qty}</span><b>{money(item.price * item.qty)}</b></div>)}<div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Delivery</span><b>{money(delivery)}</b></div><div className="gt-summary-total"><span>Total</span><b>{money(subtotal + delivery)}</b></div><p>Guest checkout · No password needed</p></aside></div>
  </section>
}

function Account({ session, authReady }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const user = session?.user

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      setMessage(mode === 'signup' ? 'Account created. Check your email if confirmation is enabled.' : 'You are signed in.')
    } catch (authError) { setError(authError.message) } finally { setBusy(false) }
  }

  async function upgradeGuest(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email, password })
      if (updateError) throw updateError
      setMessage('Account details saved. Confirm your email if Supabase asks you to.')
    } catch (authError) { setError(authError.message) } finally { setBusy(false) }
  }

  if (!authReady) return <section className="gt-page gt-narrow"><div className="gt-empty">Loading account…</div></section>
  return <section className="gt-page gt-narrow"><PageHeading eyebrow="YOUR GOLDEN TOUCH" title={user ? 'Your account' : 'Welcome'} subtitle="Accounts are optional. You can shop and order without registering." />
    <div className="gt-form-card">
      {user ? <>
        <div className="gt-account-state"><CircleUserRound size={35} /><div><b>{user.email || 'Guest checkout session'}</b><span>{user.is_anonymous ? 'You are using a guest session.' : 'Signed in customer'}</span></div></div>
        {user.is_anonymous && <form onSubmit={upgradeGuest} className="gt-form-stack"><h3>Keep your guest orders</h3><p className="gt-small-note">Add an email and password to turn this guest session into an account.</p><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Create password<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="gt-button gt-button-gold" disabled={busy}>Save account details</button></form>}
        <Link className="gt-button gt-button-outline-dark gt-full" to="/orders">My orders</Link>
        <button className="gt-logout" onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sign out</button>
      </> : <>
        <div className="gt-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button></div>
        <form onSubmit={submit} className="gt-form-stack"><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required /></label>{error && <div className="gt-error">{error}</div>}{message && <div className="gt-success-message">{message}</div>}<button className="gt-button gt-button-gold gt-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button></form>
        <p className="gt-small-note">Want to shop without an account? <Link to="/">Continue as guest</Link>.</p>
      </>}
      {error && user && <div className="gt-error">{error}</div>}{message && user && <div className="gt-success-message">{message}</div>}
    </div>
  </section>
}

function Orders({ session, authReady }) {
  const [orders, setOrders] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!session?.user) return
    let active = true
    setBusy(true)
    supabase.from('orders').select('id,tracking_code,total,status,payment_method,created_at')
      .eq('user_id', session.user.id).order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(queryError.message)
        setOrders(data || [])
        setBusy(false)
      })
    return () => { active = false }
  }, [session])
  if (!authReady) return <section className="gt-page"><div className="gt-empty">Loading orders…</div></section>
  return <section className="gt-page gt-narrow"><PageHeading eyebrow="ORDER HISTORY" title="Your orders" subtitle="Orders placed in this browser session or linked customer account." />
    {!session?.user ? <div className="gt-empty-panel"><Package size={38} /><h2>Find your orders</h2><p>Use the same browser session you checked out with, or sign in to your account.</p><Link className="gt-button gt-button-gold" to="/account">Sign in / Create account</Link></div> : busy ? <div className="gt-empty">Loading orders…</div> : error ? <div className="gt-error">{error}</div> : orders.length ? <div className="gt-order-list">{orders.map((order) => <div className="gt-order-card" key={order.id}><div><b>#{shortId(order.id)}</b><span>{dateTime(order.created_at)}</span></div><div><strong>{money(order.total)}</strong><span className={`gt-status status-${order.status}`}>{order.status?.replaceAll('_', ' ')}</span></div><p>Tracking code: <b>{order.tracking_code || 'Not assigned'}</b></p></div>)}</div> : <div className="gt-empty-panel"><Package size={38} /><h2>No orders found</h2><p>Orders placed from another browser or guest session will not appear here. Use Track order with your tracking code and phone number.</p><Link to="/track" className="gt-button gt-button-gold">Track an order</Link></div>}
  </section>
}

function TrackOrder() {
  const [trackingCode, setTrackingCode] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setOrder(null)
    try {
      await ensureCustomerSession()
      const { data, error: rpcError } = await supabase.rpc('track_guest_order', { p_tracking_code: trackingCode.trim(), p_phone: phone.trim() })
      if (rpcError) throw rpcError
      const result = Array.isArray(data) ? data[0] : data
      if (!result) throw new Error('No order found. Please check your tracking code and phone number.')
      setOrder(result)
    } catch (trackError) { setError(trackError.message || 'Unable to find this order.') } finally { setBusy(false) }
  }
  return <section className="gt-page gt-narrow"><PageHeading eyebrow="ORDER UPDATES" title="Track your order" subtitle="Enter the tracking code from your order confirmation and the phone number used at checkout." />
    <form className="gt-form-card gt-form-stack" onSubmit={submit}><label>Tracking code<input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="GT-XXXXXXXX" required /></label><label>Mobile number<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" required /></label>{error && <div className="gt-error">{error}</div>}<button className="gt-button gt-button-gold gt-full" disabled={busy}>{busy ? 'Searching…' : 'Find my order'}</button></form>
    {order && <div className="gt-order-card gt-track-result"><div className="gt-eyebrow">ORDER FOUND</div><h2>{order.tracking_code || trackingCode}</h2><span className={`gt-status status-${order.status}`}>{String(order.status || 'pending').replaceAll('_', ' ')}</span><div className="gt-order-facts"><div><span>Customer</span><b>{order.customer_name || '—'}</b></div><div><span>Total</span><b>{money(order.total)}</b></div><div><span>Placed</span><b>{dateTime(order.created_at)}</b></div></div></div>}
  </section>
}

function Admin({ session, authReady, products, refreshProducts }) {
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [allProducts, setAllProducts] = useState(products)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [newProduct, setNewProduct] = useState({ name: '', category: '', description: '', price: '', stock: '0', image_url: '' })
  const isAdmin = Boolean(session?.user?.email && session.user.email.toLowerCase() === String(ADMIN_EMAIL || '').toLowerCase())

  async function refresh() {
    if (!isAdmin) return
    setBusy(true); setError('')
    const [orderResult, productResult] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
    ])
    if (orderResult.error) setError(orderResult.error.message)
    if (productResult.error) setError((current) => current ? `${current} · ${productResult.error.message}` : productResult.error.message)
    setOrders(orderResult.data || [])
    setAllProducts(productResult.data || [])
    setBusy(false)
  }
  useEffect(() => { if (isAdmin) refresh() }, [isAdmin])

  async function updateStatus(id, status) {
    setNotice(''); setError('')
    const { error: rpcError } = await supabase.rpc('admin_set_order_status', { p_order_id: id, p_status: status, p_note: '' })
    if (rpcError) { setError(rpcError.message); return }
    setNotice('Order status updated.')
    refresh()
  }

  async function addProduct(event) {
    event.preventDefault(); setNotice(''); setError('')
    const payload = {
      name: newProduct.name.trim(), category: newProduct.category.trim() || null,
      description: newProduct.description.trim() || null, price: Number(newProduct.price),
      stock: Number(newProduct.stock), image_url: newProduct.image_url.trim() || null, is_active: true,
    }
    const { error: insertError } = await supabase.from('products').insert(payload)
    if (insertError) { setError(insertError.message); return }
    setNotice('Product added successfully.')
    setNewProduct({ name: '', category: '', description: '', price: '', stock: '0', image_url: '' })
    refresh(); refreshProducts?.()
  }

  async function toggleProduct(product) {
    const { error: updateError } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    if (updateError) setError(updateError.message)
    else { setNotice('Product visibility updated.'); refresh(); refreshProducts?.() }
  }

  if (!authReady) return <section className="gt-page"><div className="gt-empty">Loading admin access…</div></section>
  if (!session?.user) return <section className="gt-page gt-narrow"><div className="gt-empty-panel"><ShieldCheck size={40} /><h2>Seller Central</h2><p>Sign in with your administrator account to manage Golden Touch.</p><Link className="gt-button gt-button-gold" to="/account">Admin sign in</Link></div></section>
  if (!isAdmin) return <section className="gt-page gt-narrow"><div className="gt-empty-panel"><ShieldCheck size={40} /><h2>Admin access only</h2><p>This account is not authorized to open the store dashboard.</p><button className="gt-button gt-button-outline-dark" onClick={() => supabase.auth.signOut()}>Sign out</button></div></section>

  return <section className="gt-admin-page"><aside className="gt-admin-sidebar"><div className="gt-admin-brand"><img src={`${import.meta.env.BASE_URL}golden-touch-logo.jpeg`} alt="Golden Touch" /><span><b>GOLDEN TOUCH</b><small>SELLER DESK</small></span></div><button className={tab === 'orders' ? 'selected' : ''} onClick={() => setTab('orders')}><ClipboardList /> Orders</button><button className={tab === 'products' ? 'selected' : ''} onClick={() => setTab('products')}><Package /> Products</button><div className="gt-admin-side-foot">Signed in as admin<button onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Sign out</button></div></aside>
    <div className="gt-admin-main"><div className="gt-admin-top"><div><span>Golden Touch / Seller Desk</span><h1>{tab === 'orders' ? 'Manage orders' : 'Manage products'}</h1></div><button className="gt-button gt-button-outline-dark" onClick={refresh}>Refresh data</button></div>
      {notice && <div className="gt-success-message">{notice}</div>}{error && <div className="gt-error">{error}</div>}{busy && <div className="gt-empty">Refreshing data…</div>}
      {tab === 'orders' ? <div className="gt-admin-panel"><div className="gt-admin-panel-head"><h2>All orders</h2><span>{orders.length} total</span></div>{orders.length ? <div className="gt-table-wrap"><table className="gt-table"><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Total</th><th>Current status</th><th>Update</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><b>#{shortId(order.id)}</b><small>{order.tracking_code || 'No tracking code'}</small><small>{dateTime(order.created_at)}</small></td><td>{order.customer_name}</td><td>{order.phone}</td><td>{money(order.total)}</td><td><span className={`gt-status status-${order.status}`}>{String(order.status).replaceAll('_', ' ')}</span></td><td><select aria-label={`Update status for order ${shortId(order.id)}`} value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></td></tr>)}</tbody></table></div> : <div className="gt-empty">No orders yet.</div>}</div> : <div className="gt-admin-products-grid"><form className="gt-admin-panel gt-form-stack" onSubmit={addProduct}><h2>Add a product</h2><label>Product name<input required value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /></label><label>Category<input value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} /></label><label>Description<textarea rows={3} value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} /></label><div className="gt-two-fields"><label>Price (BDT)<input type="number" min="0" required value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} /></label><label>Stock<input type="number" min="0" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} /></label></div><label>Image URL<input type="url" value={newProduct.image_url} onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })} /></label><button className="gt-button gt-button-gold gt-full">Add product</button></form><div className="gt-admin-panel"><div className="gt-admin-panel-head"><h2>Product catalogue</h2><span>{allProducts.length} items</span></div><div className="gt-admin-product-list">{allProducts.map((product) => <div key={product.id}><div><b>{product.name}</b><span>{product.category || 'Beauty'} · {money(product.price)} · Stock {product.stock}</span></div><button className={`gt-visibility ${product.is_active ? 'active' : ''}`} onClick={() => toggleProduct(product)}>{product.is_active ? 'Active' : 'Hidden'}</button></div>)}</div></div></div>}
    </div></section>
}

function PageHeading({ eyebrow, title, subtitle }) {
  return <div className="gt-page-heading"><div className="gt-eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
}

function Footer({ settings }) {
  const phone = settings.contact_phone || DEFAULT_SETTINGS.contact_phone
  return <footer className="gt-footer"><div className="gt-footer-main"><div><Link className="gt-brand gt-footer-brand" to="/"><img className="gt-brand-logo" src={`${import.meta.env.BASE_URL}golden-touch-logo.jpeg`} alt="Golden Touch logo" /><span><strong>GOLDEN TOUCH</strong><small>BEAUTY · CARE · CONFIDENCE</small></span></Link><p>Beauty, care and confidence.</p></div><div><b>Explore</b><Link to="/">Home</Link><Link to="/orders">My orders</Link><Link to="/track">Track order</Link></div><div><b>Need help?</b><a href={`tel:${phone}`}><Phone size={15} /> {phone}</a><Link to="/account">My account</Link><Link to="/admin">Seller Central</Link></div><div><b>Visit our parlour</b><span className="gt-footer-address">Bankra, Jhingergacha, Jashore, Bangladesh</span><a href="https://www.google.com/maps/search/?api=1&query=X3HC%2B3C%20Bankra%2C%20Jhingergacha%2C%20Jashore%2C%20Bangladesh" target="_blank" rel="noreferrer">Get directions <ArrowRight size={14} /></a></div></div><div className="gt-copyright">© {new Date().getFullYear()} Golden Touch. All rights reserved.</div></footer>
}

function NotFound() {
  return <section className="gt-page gt-narrow"><div className="gt-empty-panel"><h2>Page not found</h2><p>The page you are looking for is not available.</p><Link className="gt-button gt-button-gold" to="/">Go to home</Link></div></section>
}

function SetupRequired() {
  return <div className="gt-setup"><h1>Connect your Supabase project</h1><p>Add the Vite environment variables and restart the app.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code><code>VITE_ADMIN_EMAIL</code></div>
}

const APP_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap');
:root{--gt-ink:#29231f;--gt-muted:#82776d;--gt-gold:#b58a4d;--gt-gold-dark:#8f6735;--gt-cream:#f8f5ef;--gt-line:#e9e1d6;--gt-green:#506b54}*{box-sizing:border-box}.gt-app{font-family:'DM Sans',sans-serif;color:var(--gt-ink);background:#fff;min-height:100vh}.gt-announcement{background:#332a25;color:#f7ead8;text-align:center;font-size:11px;letter-spacing:.13em;padding:9px 16px}.gt-header{height:82px;padding:0 clamp(18px,5vw,76px);display:flex;align-items:center;gap:30px;border-bottom:1px solid var(--gt-line);background:#fff;position:sticky;top:0;z-index:20}.gt-brand{display:inline-flex;align-items:center;gap:11px;text-decoration:none;color:var(--gt-ink);flex-shrink:0}.gt-brand-mark{width:42px;height:42px;border:1px solid var(--gt-gold);color:var(--gt-gold-dark);border-radius:50%;display:grid;place-items:center;font-family:'Playfair Display',serif;font-size:15px}.gt-brand strong{display:block;font-size:12px;letter-spacing:.18em}.gt-brand small{display:block;color:var(--gt-muted);font-size:8px;letter-spacing:.16em;margin-top:5px}.gt-search{margin-left:auto;display:flex;align-items:center;gap:9px;border:1px solid var(--gt-line);border-radius:4px;padding:10px 12px;width:min(270px,23vw);color:var(--gt-muted)}.gt-search input{border:0;outline:0;width:100%;font:inherit;font-size:12px}.gt-nav{display:flex;gap:23px;align-items:center}.gt-nav a{color:#62574e;text-decoration:none;font-size:12px}.gt-nav a.active,.gt-nav a:hover{color:var(--gt-gold-dark)}.gt-head-actions{display:flex;align-items:center;gap:12px}.gt-cart-link{display:flex;align-items:center;gap:7px;color:var(--gt-ink);text-decoration:none;font-size:12px}.gt-cart-link b{background:var(--gt-gold);color:#fff;border-radius:20px;min-width:20px;height:20px;display:grid;place-items:center;font-size:10px}.gt-menu-button{display:none;border:0;background:none;color:var(--gt-ink)}.gt-hero{background:var(--gt-cream);min-height:445px;padding:62px clamp(24px,10vw,150px);display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:40px;overflow:hidden}.gt-eyebrow{display:flex;align-items:center;gap:8px;color:var(--gt-gold-dark);font-size:10px;font-weight:700;letter-spacing:.19em}.gt-hero h1,.gt-page-heading h1,.gt-success-panel h1{font-family:'Playfair Display',serif;font-size:clamp(42px,5.6vw,68px);line-height:1.05;font-weight:500;margin:20px 0 16px}.gt-hero h1 em,.gt-why h2 em{color:var(--gt-gold);font-weight:500}.gt-hero-copy>p{font-size:14px;line-height:1.9;color:#72675e;max-width:420px}.gt-hero-actions{display:flex;gap:12px;margin-top:27px;flex-wrap:wrap}.gt-button{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:13px 20px;border-radius:3px;text-decoration:none;font-family:inherit;font-weight:600;font-size:12px;cursor:pointer;transition:.2s;border:1px solid transparent}.gt-button:disabled{opacity:.55;cursor:not-allowed}.gt-button-gold{background:var(--gt-gold);color:white}.gt-button-gold:hover{background:var(--gt-gold-dark)}.gt-button-outline{border-color:#c9bba9;color:#53473e}.gt-button-outline-dark{border-color:#b7a58d;color:var(--gt-ink);background:#fff}.gt-full{width:100%}.gt-hero-promise{margin-top:22px;display:flex;align-items:center;gap:9px;color:#766a5e;font-size:11px}.gt-hero-promise svg{color:var(--gt-green)}.gt-hero-art{position:relative;height:315px;display:flex;justify-content:center;align-items:end;gap:21px}.gt-art-glow{position:absolute;width:280px;height:280px;border-radius:50%;background:#eadfce;top:10px;left:50%;transform:translateX(-50%)}.gt-art-bottle{z-index:1;position:relative;box-shadow:inset -12px 0 20px #00000012,0 18px 28px #55432b20;display:flex;align-items:center;justify-content:center;text-align:center;font-family:'Playfair Display',serif;letter-spacing:.12em;color:#fff;font-size:11px}.bottle-one{width:118px;height:220px;background:linear-gradient(100deg,#96714d,#c5a477 60%,#80603e);border-radius:19px 19px 12px 12px}.bottle-one:before{content:'';position:absolute;width:49px;height:30px;top:-28px;background:#80603e;border-radius:5px 5px 0 0}.bottle-two{width:92px;height:167px;background:linear-gradient(100deg,#d4b89a,#eee1d0 65%,#b49472);border-radius:13px 13px 10px 10px;color:#886a4e}.bottle-two:before{content:'';position:absolute;width:40px;height:22px;top:-20px;background:#b49673;border-radius:5px 5px 0 0}.gt-art-flower{position:absolute;z-index:2;right:4%;top:4px;color:#b08f6b;font-size:55px}.gt-art-caption{position:absolute;z-index:3;bottom:-4px;right:0;background:white;box-shadow:0 8px 30px #40302014;padding:12px 15px;display:flex;gap:10px;align-items:center}.gt-art-caption svg{color:var(--gt-gold)}.gt-art-caption b,.gt-art-caption small{display:block}.gt-art-caption b{font-size:11px}.gt-art-caption small{font-size:10px;color:var(--gt-muted);margin-top:3px}.gt-trust-strip{display:grid;grid-template-columns:repeat(4,1fr);padding:23px clamp(25px,10vw,150px);border-bottom:1px solid var(--gt-line);gap:18px}.gt-trust-strip>div{display:flex;align-items:center;gap:13px}.gt-trust-strip b{font-family:'Playfair Display',serif;font-size:22px;color:#b9a17e;font-weight:500}.gt-trust-strip span{font-size:10px;line-height:1.5;color:#6e645d}.gt-section{padding:76px clamp(22px,8vw,120px)}.gt-section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:28px}.gt-section-heading h2,.gt-why h2{font-family:'Playfair Display',serif;font-size:36px;font-weight:500;margin:10px 0}.gt-section-heading p{color:var(--gt-muted);font-size:12px;margin:0}.gt-muted-count{font-size:11px;color:var(--gt-muted)}.gt-product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.gt-product-card{border:1px solid var(--gt-line);background:white;min-width:0}.gt-product-image{height:205px;background:#f5f0e8;position:relative;display:grid;place-items:center;overflow:hidden}.gt-product-image img{width:100%;height:100%;object-fit:cover}.gt-product-category{position:absolute;left:12px;top:12px;background:#fffdf8eF;padding:6px 9px;font-size:9px;color:#74644f}.gt-product-placeholder{display:flex;align-items:center;flex-direction:column;gap:9px;color:#b89a74}.gt-product-placeholder span{font-family:'Playfair Display',serif;letter-spacing:.18em;font-size:10px}.gt-product-details{padding:16px}.gt-product-details h3{font-family:'Playfair Display',serif;font-size:17px;font-weight:500;margin:0 0 6px}.gt-product-details p{font-size:11px;color:var(--gt-muted);line-height:1.6;min-height:36px;margin:0 0 13px}.gt-product-bottom{display:flex;justify-content:space-between;align-items:center}.gt-product-bottom strong{font-size:14px}.gt-product-bottom button{border:1px solid #d9c9b3;background:#fff;color:#71542f;padding:8px 11px;display:flex;align-items:center;gap:5px;font:600 10px 'DM Sans';cursor:pointer}.gt-product-bottom button:disabled{opacity:.45;cursor:not-allowed}.gt-why{background:#f8f5ef;padding:65px clamp(22px,8vw,120px);text-align:center}.gt-why>.gt-eyebrow{justify-content:center}.gt-why h2{font-size:35px}.gt-why-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:35px;margin-top:35px}.gt-why-grid article{padding:18px}.gt-why-grid svg{color:var(--gt-gold);width:24px;height:24px}.gt-why-grid h3{font-family:'Playfair Display',serif;font-weight:500;font-size:18px}.gt-why-grid p{font-size:12px;color:var(--gt-muted);line-height:1.8}.gt-why-grid a{color:var(--gt-gold-dark);text-decoration:none;font-size:11px;display:inline-flex;gap:6px;align-items:center}.gt-footer{background:#302722;color:#f2e9df;padding:43px clamp(22px,8vw,120px) 17px}.gt-footer-main{display:grid;grid-template-columns:2fr 1fr 1fr;gap:35px;padding-bottom:28px}.gt-footer-brand{color:white}.gt-footer-main p{font-size:11px;color:#bcb0a4}.gt-footer-main>div:not(:first-child){display:flex;flex-direction:column;gap:10px}.gt-footer-main b{font-size:11px;color:#e8d9c6;margin-bottom:3px}.gt-footer-main a:not(.gt-brand){color:#bcb0a4;text-decoration:none;font-size:11px;display:flex;align-items:center;gap:7px}.gt-copyright{border-top:1px solid #ffffff1d;padding-top:15px;color:#9e9185;font-size:9px}.gt-page{max-width:1160px;padding:55px 24px 85px;margin:auto;min-height:450px}.gt-narrow{max-width:690px}.gt-page-heading{margin-bottom:30px}.gt-page-heading h1{font-size:43px;margin:12px 0 7px}.gt-page-heading p{color:var(--gt-muted);font-size:13px;line-height:1.7}.gt-empty,.gt-empty-panel{text-align:center;padding:38px;color:var(--gt-muted);font-size:13px}.gt-empty-panel{border:1px solid var(--gt-line);background:#fdfbf7;padding:45px 25px}.gt-empty-panel>svg{color:var(--gt-gold);margin-bottom:13px}.gt-empty-panel h2{font-family:'Playfair Display',serif;font-weight:500;font-size:25px;color:var(--gt-ink)}.gt-empty-panel p{font-size:12px;line-height:1.7;margin-bottom:22px}.gt-cart-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(270px,.8fr);gap:28px;align-items:start}.gt-cart-items,.gt-summary,.gt-form-card,.gt-order-card{border:1px solid var(--gt-line);background:#fff;padding:23px}.gt-cart-item{display:flex;align-items:center;gap:15px;border-bottom:1px solid var(--gt-line);padding:0 0 18px;margin-bottom:18px}.gt-cart-item:last-child{border:0;margin:0;padding:0}.gt-cart-thumb{width:68px;height:68px;background:var(--gt-cream);display:grid;place-items:center;color:var(--gt-gold);flex-shrink:0;overflow:hidden}.gt-cart-thumb img{width:100%;height:100%;object-fit:cover}.gt-cart-item-info{flex:1;min-width:0}.gt-cart-item-info b,.gt-cart-item-info span{display:block}.gt-cart-item-info b{font-size:12px}.gt-cart-item-info span{color:var(--gt-muted);font-size:10px;margin-top:4px}.gt-quantity{display:inline-flex;align-items:center;gap:12px;margin-top:9px;border:1px solid var(--gt-line);padding:4px 7px}.gt-quantity button,.gt-icon-button{background:none;border:0;cursor:pointer;color:#786b5e;display:grid;place-items:center}.gt-quantity b{font-size:11px}.gt-cart-item>strong{font-size:12px}.gt-summary{position:sticky;top:100px}.gt-summary h3{font-family:'Playfair Display',serif;font-size:20px;font-weight:500;margin:0 0 20px}.gt-summary>div{display:flex;justify-content:space-between;gap:10px;margin:12px 0;font-size:11px;color:var(--gt-muted)}.gt-summary>div b{color:var(--gt-ink)}.gt-summary .gt-summary-total{border-top:1px solid var(--gt-line);padding-top:15px;margin-top:16px;font-size:13px;color:var(--gt-ink)}.gt-summary-total b{font-size:17px}.gt-summary>p,.gt-small-note{font-size:10px;color:var(--gt-muted);line-height:1.6;margin-top:14px}.gt-form-card{display:flex;flex-direction:column;gap:15px}.gt-form-card h2{font-family:'Playfair Display',serif;font-weight:500;font-size:23px;margin:0 0 3px}.gt-form-card label,.gt-form-stack label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:600;color:#5e5348}.gt-form-card input,.gt-form-card textarea,.gt-form-card select,.gt-form-stack input,.gt-form-stack textarea,.gt-table select{width:100%;border:1px solid #ded5ca;background:#fff;padding:11px 12px;font:12px 'DM Sans';color:var(--gt-ink);border-radius:2px;outline-color:var(--gt-gold)}.gt-form-card textarea,.gt-form-stack textarea{resize:vertical}.gt-form-stack{display:flex;flex-direction:column;gap:14px}.gt-error,.gt-success-message{padding:11px 13px;font-size:11px;line-height:1.6}.gt-error{background:#fff0ee;color:#a2382c}.gt-success-message{background:#eff7ef;color:#356442}.gt-success-panel{text-align:center;border:1px solid var(--gt-line);padding:45px 26px}.gt-success-icon{color:var(--gt-green);margin-bottom:18px}.gt-success-panel h1{font-size:43px;margin:10px}.gt-success-panel>p{font-size:13px;color:var(--gt-muted)}.gt-tracking-code{margin:25px auto 10px;padding:16px;background:var(--gt-cream);max-width:360px}.gt-tracking-code span,.gt-tracking-code strong{display:block}.gt-tracking-code span{font-size:10px;color:var(--gt-muted)}.gt-tracking-code strong{font-size:22px;letter-spacing:.09em;margin-top:7px}.gt-success-panel .gt-button{margin-top:15px}.gt-text-link{display:block;color:var(--gt-gold-dark);font-size:11px;margin-top:17px}.gt-account-state{display:flex;align-items:center;gap:13px;padding:15px;background:var(--gt-cream);margin-bottom:18px}.gt-account-state svg{color:var(--gt-gold)}.gt-account-state b,.gt-account-state span{display:block;font-size:12px}.gt-account-state span{font-size:10px;color:var(--gt-muted);margin-top:4px}.gt-tabs{display:flex;border-bottom:1px solid var(--gt-line);margin-bottom:20px}.gt-tabs button{flex:1;background:none;border:0;padding:12px;font:600 11px 'DM Sans';color:var(--gt-muted);cursor:pointer}.gt-tabs button.active{color:var(--gt-gold-dark);border-bottom:2px solid var(--gt-gold)}.gt-logout{border:0;background:none;color:#8c4c43;font:600 11px 'DM Sans';display:flex;align-items:center;gap:7px;margin:18px auto 0;cursor:pointer}.gt-order-list{display:grid;gap:12px}.gt-order-card{padding:18px}.gt-order-card>div{display:flex;justify-content:space-between;gap:15px}.gt-order-card span,.gt-order-card small{color:var(--gt-muted);font-size:10px}.gt-order-card p{font-size:11px;color:var(--gt-muted);margin:14px 0 0}.gt-status{display:inline-block;text-transform:capitalize;background:#f1eee9;color:#6a5c4e;border-radius:2px;padding:5px 8px;font-size:9px!important}.status-delivered{background:#edf6ed;color:#356a43}.status-cancelled{background:#fff0ee;color:#a2382c}.status-shipped,.status-out_for_delivery{background:#edf3fa;color:#3e6085}.gt-track-result{margin-top:20px}.gt-track-result h2{font-family:'Playfair Display',serif;font-weight:500}.gt-order-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}.gt-order-facts span,.gt-order-facts b{display:block;font-size:10px}.gt-order-facts span{color:var(--gt-muted);margin-bottom:5px}.gt-admin-page{max-width:1500px;margin:auto;padding:35px 24px 70px;display:grid;grid-template-columns:220px 1fr;gap:25px;min-height:620px}.gt-admin-sidebar{background:#302822;color:#f8efe5;padding:19px;display:flex;flex-direction:column;gap:8px;min-height:440px}.gt-admin-brand{display:flex;align-items:center;gap:10px;padding:8px 3px 22px;border-bottom:1px solid #ffffff24;margin-bottom:10px}.gt-admin-brand svg{color:#d3ad75}.gt-admin-brand b,.gt-admin-brand small{display:block}.gt-admin-brand b{font-size:10px;letter-spacing:.12em}.gt-admin-brand small{font-size:8px;color:#bcae9f;margin-top:4px;letter-spacing:.14em}.gt-admin-sidebar>button{display:flex;gap:10px;align-items:center;border:0;background:transparent;color:#d7c9bb;text-align:left;padding:12px;font:12px 'DM Sans';cursor:pointer}.gt-admin-sidebar>button.selected{background:#ffffff16;color:#fff}.gt-admin-sidebar>button svg{width:17px}.gt-admin-side-foot{margin-top:auto;color:#bcae9f;font-size:9px;border-top:1px solid #ffffff24;padding-top:16px}.gt-admin-side-foot button{display:flex;align-items:center;gap:7px;background:none;border:0;color:white;margin-top:10px;font:11px 'DM Sans';cursor:pointer}.gt-admin-main{min-width:0}.gt-admin-top{display:flex;justify-content:space-between;align-items:center;margin:0 0 20px}.gt-admin-top span{font-size:10px;color:var(--gt-muted)}.gt-admin-top h1{font-family:'Playfair Display',serif;font-size:32px;font-weight:500;margin:7px 0}.gt-admin-panel{border:1px solid var(--gt-line);padding:20px;background:white;min-width:0}.gt-admin-panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.gt-admin-panel-head h2,.gt-admin-panel h2{font-family:'Playfair Display',serif;font-size:20px;font-weight:500;margin:0}.gt-admin-panel-head span{font-size:10px;color:var(--gt-muted)}.gt-table-wrap{overflow-x:auto}.gt-table{border-collapse:collapse;width:100%;font-size:10px;min-width:700px}.gt-table th{text-align:left;color:var(--gt-muted);font-weight:600;background:#faf8f4}.gt-table th,.gt-table td{padding:12px 10px;border-bottom:1px solid var(--gt-line);vertical-align:middle}.gt-table td small{display:block;color:var(--gt-muted);font-size:9px;margin-top:4px}.gt-table select{padding:8px;font-size:10px}.gt-admin-products-grid{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(350px,1.2fr);gap:18px;align-items:start}.gt-two-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gt-admin-product-list>div{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--gt-line)}.gt-admin-product-list b,.gt-admin-product-list span{display:block}.gt-admin-product-list b{font-size:11px}.gt-admin-product-list span{font-size:9px;color:var(--gt-muted);margin-top:5px}.gt-visibility{border:1px solid var(--gt-line);background:#f5f2ed;padding:6px 9px;font:10px 'DM Sans';cursor:pointer}.gt-visibility.active{background:#edf6ed;color:#356a43;border-color:#d7e8d7}.gt-setup{padding:40px;font-family:'DM Sans';display:grid;gap:12px}.gt-setup code{background:#f6f3ee;padding:10px;width:max-content}@media(max-width:1050px){.gt-header{gap:16px}.gt-search{width:190px}.gt-nav{gap:13px}.gt-product-grid{grid-template-columns:repeat(3,1fr)}.gt-hero{padding-left:7vw;padding-right:7vw}}@media(max-width:760px){.gt-header{height:68px;padding:0 16px}.gt-brand-mark{width:36px;height:36px}.gt-brand strong{font-size:10px}.gt-brand small{font-size:7px}.gt-search{display:none}.gt-menu-button{display:block}.gt-nav{display:none;position:absolute;top:68px;left:0;right:0;background:#fff;padding:18px 23px;border-bottom:1px solid var(--gt-line);box-shadow:0 10px 20px #00000008;flex-direction:column;align-items:flex-start}.gt-nav.is-open{display:flex}.gt-hero{grid-template-columns:1fr;padding:48px 25px 32px;gap:28px}.gt-hero h1{font-size:48px}.gt-hero-art{height:250px;transform:scale(.88);transform-origin:top center;margin-bottom:-25px}.gt-trust-strip{grid-template-columns:repeat(2,1fr);padding:20px 25px}.gt-section{padding:52px 18px}.gt-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gt-product-image{height:155px}.gt-product-details{padding:12px}.gt-product-details h3{font-size:15px}.gt-product-details p{font-size:10px}.gt-why{padding:48px 20px}.gt-why-grid{grid-template-columns:1fr;gap:8px}.gt-footer-main{grid-template-columns:1fr 1fr}.gt-footer-main>div:first-child{grid-column:1/-1}.gt-page{padding:38px 17px 60px}.gt-page-heading h1{font-size:36px}.gt-cart-layout{grid-template-columns:1fr}.gt-summary{position:static}.gt-admin-page{grid-template-columns:1fr;padding:20px 14px 55px}.gt-admin-sidebar{min-height:0;display:grid;grid-template-columns:1fr 1fr}.gt-admin-brand{grid-column:1/-1;padding-bottom:14px}.gt-admin-side-foot{grid-column:1/-1;margin-top:8px}.gt-admin-products-grid{grid-template-columns:1fr}.gt-admin-top{align-items:flex-start;gap:10px}.gt-admin-top h1{font-size:26px}.gt-order-facts{grid-template-columns:1fr 1fr}.gt-cart-item{gap:9px}.gt-cart-thumb{width:55px;height:55px}.gt-cart-item>strong{font-size:10px}.gt-quantity{gap:7px}.gt-form-card{padding:17px}}@media(max-width:420px){.gt-product-grid{grid-template-columns:1fr 1fr}.gt-product-image{height:130px}.gt-cart-item-info b{font-size:10px}.gt-cart-item>strong{display:none}.gt-head-actions{margin-left:auto}.gt-cart-link span{display:none}}

/* Golden Touch retail refresh — Lira-inspired information architecture, original brand styling */
.gt-utility-bar{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:8px clamp(18px,5vw,76px);background:#171512;color:#e8d8b9;font-size:9px;letter-spacing:.12em;text-transform:uppercase}
.gt-utility-bar a{color:#fff;text-decoration:none;font-weight:700;letter-spacing:.04em}
.gt-retail-header{height:92px;padding:12px clamp(18px,5vw,76px);gap:26px;background:#fffdf9;border-bottom:1px solid #eee6d9}
.gt-brand{gap:12px;flex-shrink:0;text-decoration:none}
.gt-brand-logo{width:62px;height:62px;object-fit:cover;border-radius:50%;border:1px solid #c8a96d;box-shadow:0 2px 9px #30201012}
.gt-brand strong{font-family:'Playfair Display',serif;font-size:16px;letter-spacing:.12em;color:#211b16}
.gt-brand small{font-size:8px;letter-spacing:.19em;color:#9b7842;margin-top:5px}
.gt-retail-header .gt-search{flex:1;max-width:470px;width:auto;height:42px;background:#f7f4ed;border:1px solid #eee7db;border-radius:3px;padding:0 14px}
.gt-retail-header .gt-search input{background:transparent;font-size:12px}
.gt-retail-header .gt-nav{gap:20px}
.gt-retail-header .gt-nav a{font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#51473b}
.gt-retail-header .gt-nav a.active,.gt-retail-header .gt-nav a:hover{color:#a37a3c}
.gt-account-link{display:flex;align-items:center;gap:6px;color:#51473b;text-decoration:none;font-size:10px;font-weight:700}
.gt-retail-header .gt-head-actions{gap:17px}
.gt-retail-header .gt-cart-link{border:1px solid #d7c5a6;border-radius:2px;padding:10px 12px;color:#5f4828;font-size:10px}
.gt-retail-header .gt-cart-link b{background:#a9844b;color:white;border-radius:50%;min-width:19px;height:19px;display:grid;place-items:center;font-size:9px}
.gt-category-ribbon{display:flex;align-items:center;justify-content:center;gap:clamp(15px,2.6vw,36px);padding:0 18px;min-height:46px;background:#f6f1e8;border-bottom:1px solid #e8dfd1;overflow-x:auto;white-space:nowrap;scrollbar-width:thin}
.gt-category-ribbon button{border:0;background:none;color:#6b5b45;padding:14px 0 12px;font:700 9px 'DM Sans';letter-spacing:.12em;cursor:pointer;border-bottom:2px solid transparent}
.gt-category-ribbon button:hover,.gt-category-ribbon button.active{color:#9a7337;border-bottom-color:#b8945d}
.gt-luxe-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1.02fr .98fr;align-items:center;gap:28px;min-height:455px;padding:62px clamp(24px,8vw,120px);background:linear-gradient(115deg,#171512 0%,#262018 55%,#46351e 100%);color:#fff}
.gt-luxe-hero:after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 75% 38%,#d5b77a20 0,transparent 37%),linear-gradient(90deg,transparent,#0000001c);pointer-events:none}
.gt-luxe-hero-copy,.gt-luxe-hero-art{position:relative;z-index:1}
.gt-luxe-kicker{display:flex;align-items:center;gap:8px;color:#d9ba83;font-size:10px;font-weight:700;letter-spacing:.19em}
.gt-luxe-hero h1{font-family:'Playfair Display',serif;font-size:clamp(44px,5.1vw,68px);line-height:1.04;font-weight:500;letter-spacing:-.035em;margin:20px 0 16px;color:#fff}
.gt-luxe-hero h1 em{font-weight:500;color:#d9b879}
.gt-luxe-hero-copy>p{max-width:465px;color:#e0d6c7;font-size:14px;line-height:1.85;margin:0}
.gt-luxe-hero-actions{display:flex;align-items:center;gap:24px;flex-wrap:wrap;margin-top:26px}
.gt-luxe-hero .gt-button-gold{background:#c3a06a;color:#191611;border-color:#c3a06a;padding:13px 19px;font-size:10px;letter-spacing:.07em}
.gt-hero-link{display:flex;align-items:center;gap:3px;color:#f2e8d6;text-decoration:none;font-size:10px;font-weight:700;letter-spacing:.07em}
.gt-luxe-assurances{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:34px;color:#c8bba7;font-size:9px;letter-spacing:.04em}
.gt-luxe-assurances span{display:flex;align-items:center;gap:6px}.gt-luxe-assurances svg{color:#d5b276}.gt-luxe-assurances i{width:3px;height:3px;border-radius:50%;background:#a88a5b}
.gt-luxe-hero-art{display:flex;align-items:center;justify-content:center;min-height:320px}
.gt-hero-logo-frame{position:relative;z-index:2;width:min(310px,70%);aspect-ratio:1;border-radius:50%;padding:9px;background:linear-gradient(145deg,#f0d79e,#94713e 45%,#e7ce94 75%,#85612f);box-shadow:0 25px 75px #0008,0 0 0 12px #d7b77912}
.gt-hero-logo-frame img{width:100%;height:100%;display:block;object-fit:cover;border-radius:50%;border:3px solid #171512}
.gt-hero-orbit{position:absolute;border:1px solid #d6b77a35;border-radius:50%;aspect-ratio:1}
.gt-hero-orbit.orbit-one{width:380px}.gt-hero-orbit.orbit-two{width:460px;border-style:dashed;border-color:#d6b77a20}
.gt-hero-floating-card{position:absolute;z-index:3;right:3%;bottom:4%;display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fffdf6;color:#36291a;box-shadow:0 12px 34px #0005}
.gt-hero-floating-card>svg{color:#a67f43}.gt-hero-floating-card b,.gt-hero-floating-card small{display:block}.gt-hero-floating-card b{font:600 11px 'DM Sans'}.gt-hero-floating-card small{font-size:8px;color:#88745a;margin-top:3px;letter-spacing:.05em}
.gt-hero-side-note{position:absolute;left:0;top:50%;transform:translateY(-50%) rotate(-90deg);font-size:8px;letter-spacing:.22em;color:#d9c39e88}
.gt-luxe-benefits{display:grid;grid-template-columns:repeat(4,1fr);padding:20px clamp(22px,8vw,120px);background:#fffdf9;border-bottom:1px solid #eee8df;gap:15px}
.gt-luxe-benefits>div{display:flex;align-items:center;gap:11px;justify-content:center;border-right:1px solid #eee7dc}.gt-luxe-benefits>div:last-child{border:0}
.gt-benefit-icon{display:grid;place-items:center;width:35px;height:35px;border:1px solid #d7c5a5;color:#a47c42;border-radius:50%;font-size:16px}
.gt-luxe-benefits b,.gt-luxe-benefits small{display:block}.gt-luxe-benefits b{font-size:10px;color:#3c3329}.gt-luxe-benefits small{margin-top:4px;color:#938475;font-size:9px}
.gt-luxe-categories,.gt-luxe-products{max-width:1440px;margin:0 auto;padding:65px clamp(20px,5vw,70px)}
.gt-luxe-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:27px}
.gt-luxe-section-heading h2{font:500 clamp(27px,3vw,36px) 'Playfair Display',serif;color:#29231e;margin:8px 0}
.gt-luxe-section-heading p{font-size:12px;color:#8a7e70;margin:0}
.gt-luxe-section-heading>span{font-size:8px;color:#a18a67;letter-spacing:.18em;white-space:nowrap}
.gt-category-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px}
.gt-category-tile{position:relative;min-height:170px;padding:19px 13px 16px;border:1px solid #ece4d8;background:#fbf9f4;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s,border-color .2s;color:#32291f}
.gt-category-tile:hover,.gt-category-tile.selected{transform:translateY(-4px);border-color:#c5a16a;box-shadow:0 12px 24px #5e47200d}
.gt-category-icon{display:grid;place-items:center;width:61px;height:61px;border-radius:50%;background:#eee5d5;font-size:28px;margin-bottom:14px}
.category-tone-2 .gt-category-icon{background:#efe5df}.category-tone-3 .gt-category-icon{background:#e8e7db}.category-tone-4 .gt-category-icon{background:#e5ece7}.category-tone-5 .gt-category-icon{background:#f2e4e6}.category-tone-6 .gt-category-icon{background:#e7e6ed}.category-tone-7 .gt-category-icon{background:#eee6d9}
.gt-category-tile b{font-size:11px}.gt-category-tile small{display:block;margin-top:6px;font-size:8px;line-height:1.5;color:#928575}.gt-category-arrow{position:absolute;right:10px;top:10px;color:#a98a5c;opacity:0;transition:opacity .2s}.gt-category-tile:hover .gt-category-arrow{opacity:1}
.gt-luxe-promo-row{max-width:1300px;padding:0 clamp(20px,5vw,70px);margin:0 auto 20px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.gt-promo-card{min-height:205px;padding:27px 30px;display:flex;justify-content:space-between;align-items:center;overflow:hidden;position:relative}
.gt-promo-card>div:first-child{position:relative;z-index:1}.gt-promo-card>div:first-child>span{font-size:8px;letter-spacing:.18em;font-weight:700}.gt-promo-card h3{font:500 27px/1.12 'Playfair Display',serif;margin:11px 0 15px}.gt-promo-card a{display:inline-flex;align-items:center;gap:5px;text-decoration:none;font-size:9px;font-weight:700;letter-spacing:.06em}
.gt-promo-dark{background:#24201b;color:#f5e8d1}.gt-promo-dark>div:first-child>span{color:#d8b77c}.gt-promo-dark a{color:#dfc28f}.gt-promo-light{background:#eee6d8;color:#32281e}.gt-promo-light>div:first-child>span{color:#9a7540}.gt-promo-light a{color:#806039}
.gt-promo-flower,.gt-promo-sparkle{font-size:120px;line-height:1;opacity:.17;position:absolute;right:27px;top:18px}.gt-promo-flower{color:#e5c78e}.gt-promo-sparkle{font-size:160px;color:#96764b}
.gt-luxe-products{padding-top:55px}
.gt-product-filters{display:flex;gap:8px;margin:-7px 0 20px}.gt-product-filters button{border:1px solid #e8dfd2;background:white;color:#796d5e;padding:8px 13px;font:600 9px 'DM Sans';cursor:pointer}.gt-product-filters button.active,.gt-product-filters button:hover{border-color:#b18d56;background:#f7f1e6;color:#73552e}
.gt-luxe-products .gt-product-card{border:1px solid #eee7dd;box-shadow:0 4px 15px #30201007;transition:transform .2s,box-shadow .2s}.gt-luxe-products .gt-product-card:hover{transform:translateY(-4px);box-shadow:0 15px 30px #30201014}.gt-luxe-products .gt-product-image{background:#f6f1e8}.gt-luxe-products .gt-product-details{padding:18px}.gt-luxe-products .gt-product-bottom button{background:#28231d;border-color:#28231d;color:#f8edd9}.gt-luxe-products .gt-product-bottom button:hover{background:#a98550;border-color:#a98550;color:#fff}
.gt-no-products{margin-top:10px;padding:32px}.gt-no-products h3{font:500 21px 'Playfair Display',serif;margin:12px 0 5px}.gt-no-products p{font-size:11px;color:#897c6c}
.gt-luxe-why{background:#f5f0e7}.gt-luxe-why>h2{font-size:clamp(30px,4vw,43px)}.gt-luxe-why-intro{font-size:12px;color:#887b6c;margin:-10px 0 28px}
.gt-footer-brand .gt-brand-logo{width:52px;height:52px}
.gt-admin-brand img{width:42px;height:42px;object-fit:cover;border-radius:50%;border:1px solid #c2a16d}
@media(max-width:1100px){.gt-retail-header{gap:15px}.gt-retail-header .gt-nav{gap:12px}.gt-category-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.gt-luxe-hero{padding-left:6vw;padding-right:6vw}}
@media(max-width:760px){.gt-utility-bar{justify-content:center;gap:10px;font-size:8px;letter-spacing:.07em;flex-wrap:wrap}.gt-utility-bar span:last-child{display:none}.gt-retail-header{height:auto;min-height:73px;padding:9px 15px;gap:10px}.gt-brand-logo{width:46px;height:46px}.gt-brand strong{font-size:11px}.gt-brand small{font-size:7px;letter-spacing:.12em}.gt-retail-header .gt-search{display:none}.gt-retail-header .gt-nav{display:none;top:73px}.gt-retail-header .gt-nav.is-open{display:flex}.gt-account-link span{display:none}.gt-retail-header .gt-head-actions{gap:10px}.gt-retail-header .gt-cart-link{padding:8px}.gt-category-ribbon{justify-content:flex-start;min-height:40px;gap:20px}.gt-category-ribbon button{font-size:8px;padding:12px 0 10px}.gt-luxe-hero{grid-template-columns:1fr;padding:45px 23px 36px;gap:12px}.gt-luxe-hero h1{font-size:47px;margin:15px 0 12px}.gt-luxe-hero-copy>p{font-size:12px}.gt-luxe-hero-art{min-height:260px}.gt-hero-logo-frame{width:220px}.gt-hero-orbit.orbit-one{width:280px}.gt-hero-orbit.orbit-two{width:330px}.gt-hero-floating-card{right:0;bottom:0;padding:9px 12px}.gt-hero-side-note{left:-10px}.gt-luxe-assurances{margin-top:23px}.gt-luxe-benefits{grid-template-columns:repeat(2,1fr);padding:18px 14px;gap:16px}.gt-luxe-benefits>div{justify-content:flex-start;border:0}.gt-benefit-icon{width:31px;height:31px;flex-shrink:0}.gt-luxe-categories,.gt-luxe-products{padding:46px 16px}.gt-luxe-section-heading{align-items:flex-start}.gt-luxe-section-heading>span{display:none}.gt-category-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.gt-category-tile{min-height:143px;padding:14px 8px}.gt-category-icon{width:52px;height:52px;font-size:24px;margin-bottom:10px}.gt-luxe-promo-row{grid-template-columns:1fr;padding:0 16px;gap:10px}.gt-promo-card{min-height:165px;padding:23px}.gt-promo-card h3{font-size:24px}.gt-luxe-products .gt-product-details{padding:12px}.gt-luxe-why{padding:48px 18px}.gt-luxe-why-intro{line-height:1.7}.gt-footer-brand .gt-brand-logo{width:44px;height:44px}}
@media(max-width:420px){.gt-brand-logo{width:41px;height:41px}.gt-brand strong{font-size:10px}.gt-brand small{font-size:6px}.gt-luxe-hero h1{font-size:42px}.gt-hero-logo-frame{width:190px}.gt-luxe-benefits b{font-size:9px}.gt-luxe-benefits small{font-size:8px}}

`

export default App

