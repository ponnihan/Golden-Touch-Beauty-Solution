import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, CheckCircle2, ChevronRight, CircleUserRound, ClipboardList,
  Heart, LayoutDashboard, LogOut, Menu, Minus, Package, Phone, Plus,
  Search, ShieldCheck, ShoppingBag, Sparkles, Trash2, Truck, X, MapPin,
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
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        setSession(data?.session || null)
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
    if (!query) return products
    return products.filter((product) => `${product.name || ''} ${product.category || ''} ${product.description || ''}`.toLowerCase().includes(query))
  }, [products, search])

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
      <div className="gt-announcement">Beauty, care & confidence — delivered to your door</div>
      <header className="gt-header">
        <Link to="/" className="gt-brand" onClick={() => setMobileMenu(false)}>
          <img className="gt-logo-image" src={`${import.meta.env.BASE_URL}golden-touch-logo.jpeg`} alt="Golden Touch logo" />
          <span><strong>GOLDEN TOUCH</strong><small>BEAUTY · CARE · CONFIDENCE</small></span>
        </Link>
        <div className="gt-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search beauty products..." aria-label="Search products" /></div>
        <nav className={`gt-nav ${mobileMenu ? 'is-open' : ''}`}>
          <NavLink to="/" end onClick={() => setMobileMenu(false)}>Home</NavLink>
          <a href={`${import.meta.env.BASE_URL}#shop`} onClick={() => setMobileMenu(false)}>Shop</a>
          <a href={`${import.meta.env.BASE_URL}#our-parlour`} onClick={() => setMobileMenu(false)}>Our Parlour</a>
          <NavLink to="/track" onClick={() => setMobileMenu(false)}>Track order</NavLink>
          <NavLink to="/account" onClick={() => setMobileMenu(false)}>Account</NavLink>
        </nav>
        <div className="gt-head-actions">
          <Link to="/cart" className="gt-cart-link" aria-label={`Cart, ${cartCount} items`}><ShoppingBag size={19} /><span>Cart</span><b>{cartCount}</b></Link>
          <button className="gt-menu-button" onClick={() => setMobileMenu((value) => !value)} aria-label="Toggle menu">{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home products={filteredProducts} loading={loading} addToCart={addToCart} settings={settings} />} />
          <Route path="/cart" element={<CartPage cart={cart} updateQuantity={updateQuantity} settings={settings} />} />
          <Route path="/checkout" element={<Checkout cart={cart} setCart={setCart} settings={settings} />} />
          <Route path="/account" element={<Account session={session} authReady={authReady} />} />
          <Route path="/orders" element={<Orders session={session} authReady={authReady} />} />
          <Route path="/track" element={<TrackOrder />} />
          <Route path="/admin/*" element={<Admin session={session} authReady={authReady} products={products} refreshProducts={() => supabase.from('products').select('*').order('created_at', { ascending: false }).then(({ data }) => setProducts(data || []))} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer settings={settings} />
    </div>
  )
}

function Home({ products, loading, addToCart, settings }) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [slide, setSlide] = useState(0)
  const categories = useMemo(() => ['All', ...new Set(products.map((item) => item.category).filter(Boolean))], [products])
  const slides = [
    { eyebrow: 'YOUR BEAUTY, YOUR MOMENT', title: <>Feel beautiful.<br /><em>Every day.</em></>, copy: 'Thoughtfully selected beauty essentials and professional care from Golden Touch.' },
    { eyebrow: 'CARE THAT FEELS PERSONAL', title: <>A little care.<br /><em>A brighter you.</em></>, copy: 'Discover beauty favourites and make time for the care you deserve.' },
    { eyebrow: 'WELCOME TO GOLDEN TOUCH', title: <>Your glow.<br /><em>Your confidence.</em></>, copy: 'Shop with ease, enjoy guest checkout and get friendly local support.' },
  ]
  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % slides.length), 6500)
    return () => window.clearInterval(timer)
  }, [])
  const visibleProducts = activeCategory === 'All' ? products : products.filter((item) => item.category === activeCategory)
  return (
    <>
      <section className="gt-hero gt-hero-slider">
        <div className="gt-hero-copy" key={slide}>
          <div className="gt-eyebrow"><Sparkles size={15} /> {slides[slide].eyebrow}</div>
          <h1>{slides[slide].title}</h1>
          <p>{slides[slide].copy}</p>
          <div className="gt-hero-actions"><a className="gt-button gt-button-gold" href="#shop">Explore collection <ArrowRight size={17} /></a><a className="gt-button gt-button-outline" href="#why-us">Why Golden Touch</a></div>
          <div className="gt-hero-promise"><ShieldCheck size={17} /> Easy ordering <span>·</span> Cash on delivery available</div>
          <div className="gt-slider-controls" aria-label="Hero slides">{slides.map((item, index) => <button key={item.eyebrow} className={slide === index ? 'active' : ''} onClick={() => setSlide(index)} aria-label={`Show slide ${index + 1}`} />)}</div>
        </div>
        <div className="gt-hero-art" aria-label="Golden Touch beauty collection illustration">
          <div className="gt-art-glow" /><div className="gt-art-bottle bottle-one"><span>GOLDEN<br />TOUCH</span></div><div className="gt-art-bottle bottle-two"><span>PURE<br />CARE</span></div><div className="gt-art-flower">✿</div><div className="gt-art-caption"><Sparkles size={16} /><span><b>Golden care</b><small>Made for your glow</small></span></div>
        </div>
      </section>
      <section className="gt-promise-row"><span><ShieldCheck /> Carefully selected products</span><span><Truck /> Delivery available</span><span><ShoppingBag /> Easy guest checkout</span><span><Phone /> Friendly support</span></section>
      <section className="gt-category-section" aria-label="Shop by category">
        <div className="gt-category-heading"><div><div className="gt-eyebrow">FIND YOUR FAVOURITES</div><h2>Shop by category</h2></div><a href="#shop">View collection <ArrowRight size={15} /></a></div>
        <div className="gt-category-scroller">{categories.map((category) => <button key={category} className={activeCategory === category ? 'active' : ''} onClick={() => { setActiveCategory(category); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }) }}>{category === 'All' ? 'All products' : category}<ChevronRight size={14} /></button>)}</div>
      </section>
      <section className="gt-trust-strip"><div><b>01</b><span>Carefully selected<br />products</span></div><div><b>02</b><span>Simple & secure<br />checkout</span></div><div><b>03</b><span>Personal beauty<br />care</span></div><div><b>04</b><span>Friendly local<br />support</span></div></section>
      <section className="gt-section gt-section-products-top" id="shop">
        <div className="gt-section-heading"><div><div className="gt-eyebrow">THE GOLDEN COLLECTION</div><h2>{activeCategory === 'All' ? 'Shop our favourites' : activeCategory}</h2><p>Little essentials. A more confident you.</p></div><span className="gt-muted-count">{visibleProducts.length} products</span></div>
        {loading ? <div className="gt-empty">Loading our collection...</div> : visibleProducts.length ? <div className="gt-product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} addToCart={addToCart} />)}</div> : <div className="gt-empty">No products are available in this category yet.</div>}
      </section>
      <section className="gt-parlour" id="our-parlour" style={{ backgroundImage: `linear-gradient(90deg, rgba(25,20,17,.88), rgba(25,20,17,.72)), url("${import.meta.env.BASE_URL}golden-touch-parlour.webp")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
        <div className="gt-parlour-inner">
          <div className="gt-parlour-copy">
            <div className="gt-eyebrow">GOLDEN TOUCH · LADIES BEAUTY PARLOUR</div>
            <h2>Where beauty meets <em>confidence.</em></h2>
            <p>সৌন্দর্য আপনার, আমাদের প্রতিশ্রুতি। আপনার সৌন্দর্য ও যত্নে Golden Touch সবসময় পাশে।</p>
            <div className="gt-parlour-location"><MapPin size={18} /><span><b>Visit our parlour</b><small>বাকড়া বাজার, ঝিকরগাছা, যশোর</small></span></div>
            <a className="gt-button gt-button-gold" href={`tel:${String(settings.contact_phone || '').replace(/[^0-9+]/g, '')}`}><Phone size={16} /> Call 01990941408</a>
          </div>
          <div className="gt-parlour-services">
            <div className="gt-eyebrow">OUR PARLOUR SERVICES</div>
            <h3>আমাদের সেবা সমূহ</h3>
            <ul>
              <li>পারফেক্টলি ব্লেন্ডেড স্মোকি আইস</li><li>ওয়াটারপ্রুফ ও লং-লাস্টিং মেকআপ</li><li>হাই কোয়ালিটি প্রোডাক্ট ব্যবহার</li><li>আপনার মুখের সাথে মানানসই লুক</li><li>হেয়ার কাট, কালার ও স্টাইলিং</li><li>ম্যানিকিউর, পেডিকিউর ও নেইল আর্ট</li><li>ওয়াক্সিং, থ্রেডিং ও ব্লিচ</li><li>হাইড্রা ফেসিয়াল, হেয়ার ট্রিটমেন্ট ও হেয়ার স্পা</li>
            </ul>
          </div>
        </div>
      </section>
      <section className="gt-why" id="why-us"><div className="gt-eyebrow">MORE THAN A STORE</div><h2>A little time for <em>yourself.</em></h2><div className="gt-why-grid"><article><Heart /><h3>Care in every detail</h3><p>We believe beauty should feel personal, easy and joyful.</p></article><article><ShieldCheck /><h3>Checkout made simple</h3><p>Order as a guest. Create an account only if you want to.</p></article><article><Phone /><h3>Here to help</h3><p>Questions? Reach out to our team for friendly support.</p><a href={`https://wa.me/${String(settings.whatsapp_number || '').replace(/\\D/g, '')}`} target="_blank" rel="noreferrer">Chat with us <ArrowRight size={15} /></a></article></div></section>
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
  const emptyProduct = { name: '', category: '', description: '', price: '', stock: '0', image_url: '' }
  const [formProduct, setFormProduct] = useState(emptyProduct)
  const [editingId, setEditingId] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
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

  function resetProductForm() {
    setFormProduct(emptyProduct); setEditingId(null); setImageFile(null); setImagePreview('')
  }

  function startEdit(product) {
    setEditingId(product.id)
    setFormProduct({ name: product.name || '', category: product.category || '', description: product.description || '', price: String(product.price ?? ''), stock: String(product.stock ?? 0), image_url: product.image_url || '' })
    setImageFile(null); setImagePreview(product.image_url || '')
    setNotice('Editing product: ' + product.name)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function uploadSelectedImage() {
    if (!imageFile) return formProduct.image_url.trim() || null
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(imageFile.type)) throw new Error('Please choose a JPG, PNG, WEBP or GIF image.')
    if (imageFile.size > 10 * 1024 * 1024) throw new Error('Image must be 10 MB or smaller.')
    const extension = (imageFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `products/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('Product Image').upload(path, imageFile, { cacheControl: '3600', upsert: false, contentType: imageFile.type })
    if (uploadError) throw new Error('Image upload failed: ' + uploadError.message + '. Check that the public storage bucket is named exactly "Product Image" and upload permissions are enabled.')
    const { data } = supabase.storage.from('Product Image').getPublicUrl(path)
    return data.publicUrl
  }

  async function saveProduct(event) {
    event.preventDefault(); setNotice(''); setError('')
    if (!formProduct.name.trim()) return setError('Product name is required.')
    if (formProduct.price === '' || !Number.isFinite(Number(formProduct.price)) || Number(formProduct.price) < 0) return setError('Enter a valid price.')
    if (!Number.isFinite(Number(formProduct.stock)) || Number(formProduct.stock) < 0) return setError('Enter a valid stock quantity.')
    setBusy(true)
    try {
      const image_url = await uploadSelectedImage()
      const payload = { name: formProduct.name.trim(), category: formProduct.category.trim() || null, description: formProduct.description.trim() || null, price: Number(formProduct.price), stock: Number(formProduct.stock), image_url }
      const result = editingId
        ? await supabase.from('products').update(payload).eq('id', editingId)
        : await supabase.from('products').insert({ ...payload, is_active: true })
      if (result.error) throw result.error
      setNotice(editingId ? 'Product updated successfully.' : 'Product added successfully.')
      resetProductForm()
      await refresh()
      await refreshProducts?.()
    } catch (saveError) { setError(saveError.message || 'Could not save product.') }
    finally { setBusy(false) }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}" permanently? This cannot be undone.`)) return
    setNotice(''); setError(''); setBusy(true)
    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id)
    if (deleteError) setError(deleteError.message)
    else {
      setNotice('Product deleted.')
      if (editingId === product.id) resetProductForm()
      await refresh(); await refreshProducts?.()
    }
    setBusy(false)
  }

  async function toggleProduct(product) {
    setNotice(''); setError('')
    const { error: updateError } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    if (updateError) setError(updateError.message)
    else { setNotice('Product visibility updated.'); await refresh(); await refreshProducts?.() }
  }

  if (!authReady) return <section className="gt-page"><div className="gt-empty">Loading admin access…</div></section>
  if (!session?.user) return <section className="gt-page gt-narrow"><div className="gt-empty-panel"><ShieldCheck size={40} /><h2>Seller Central</h2><p>Sign in with your administrator account to manage Golden Touch.</p><Link className="gt-button gt-button-gold" to="/account">Admin sign in</Link></div></section>
  if (!isAdmin) return <section className="gt-page gt-narrow"><div className="gt-empty-panel"><ShieldCheck size={40} /><h2>Admin access only</h2><p>This account is not authorized to open the store dashboard.</p><button className="gt-button gt-button-outline-dark" onClick={() => supabase.auth.signOut()}>Sign out</button></div></section>

  return <section className="gt-admin-page"><aside className="gt-admin-sidebar"><div className="gt-admin-brand"><LayoutDashboard /><span><b>GOLDEN TOUCH</b><small>SELLER DESK</small></span></div><button className={tab === 'orders' ? 'selected' : ''} onClick={() => setTab('orders')}><ClipboardList /> Orders</button><button className={tab === 'products' ? 'selected' : ''} onClick={() => setTab('products')}><Package /> Products</button><div className="gt-admin-side-foot">Signed in as admin<button onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Sign out</button></div></aside>
    <div className="gt-admin-main"><div className="gt-admin-top"><div><span>Golden Touch / Seller Desk</span><h1>{tab === 'orders' ? 'Manage orders' : 'Manage products'}</h1></div><button className="gt-button gt-button-outline-dark" onClick={refresh} disabled={busy}>Refresh data</button></div>
      {notice && <div className="gt-success-message">{notice}</div>}{error && <div className="gt-error">{error}</div>}{busy && <div className="gt-empty">Working…</div>}
      {tab === 'orders' ? <div className="gt-admin-panel"><div className="gt-admin-panel-head"><h2>All orders</h2><span>{orders.length} total</span></div>{orders.length ? <div className="gt-table-wrap"><table className="gt-table"><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Total</th><th>Current status</th><th>Update</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><b>#{shortId(order.id)}</b><small>{order.tracking_code || 'No tracking code'}</small><small>{dateTime(order.created_at)}</small></td><td>{order.customer_name}</td><td>{order.phone}</td><td>{money(order.total)}</td><td><span className={`gt-status status-${order.status}`}>{String(order.status).replaceAll('_', ' ')}</span></td><td><select aria-label={`Update status for order ${shortId(order.id)}`} value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></td></tr>)}</tbody></table></div> : <div className="gt-empty">No orders yet.</div>}</div> : <div className="gt-admin-products-grid">
        <form className="gt-admin-panel gt-form-stack" onSubmit={saveProduct}>
          <h2>{editingId ? 'Edit product' : 'Add a product'}</h2>
          <label>Product name<input required value={formProduct.name} onChange={(e) => setFormProduct({ ...formProduct, name: e.target.value })} /></label>
          <label>Category<input value={formProduct.category} onChange={(e) => setFormProduct({ ...formProduct, category: e.target.value })} /></label>
          <label>Description<textarea rows={3} value={formProduct.description} onChange={(e) => setFormProduct({ ...formProduct, description: e.target.value })} /></label>
          <div className="gt-two-fields"><label>Price (BDT)<input type="number" min="0" step="0.01" required value={formProduct.price} onChange={(e) => setFormProduct({ ...formProduct, price: e.target.value })} /></label><label>Stock<input type="number" min="0" step="1" value={formProduct.stock} onChange={(e) => setFormProduct({ ...formProduct, stock: e.target.value })} /></label></div>
          <label>Product image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const file = e.target.files?.[0] || null; setImageFile(file); setImagePreview(file ? URL.createObjectURL(file) : formProduct.image_url) }} /></label>
          {imagePreview && <img src={imagePreview} alt="Product preview" style={{ width: '100%', maxHeight: 190, objectFit: 'contain', background: '#f8f5ef', border: '1px solid #e9e1d6', padding: 8 }} />}
          <label>Or paste image URL<input type="url" value={formProduct.image_url} onChange={(e) => { setFormProduct({ ...formProduct, image_url: e.target.value }); if (!imageFile) setImagePreview(e.target.value) }} /></label>
          <button className="gt-button gt-button-gold gt-full" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}</button>
          {editingId && <button type="button" className="gt-button gt-button-outline-dark gt-full" onClick={resetProductForm}>Cancel editing</button>}
          <p className="gt-small-note">Images upload to your Supabase Storage bucket named “Product Image”. Maximum image size: 10 MB.</p>
        </form>
        <div className="gt-admin-panel"><div className="gt-admin-panel-head"><h2>Product catalogue</h2><span>{allProducts.length} items</span></div>
          <div className="gt-admin-product-list">{allProducts.map((product) => <div key={product.id} style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {product.image_url ? <img src={product.image_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', background: '#f8f5ef', flexShrink: 0 }} /> : <div style={{ width: 48, height: 48, background: '#f8f5ef', display: 'grid', placeItems: 'center', color: '#b58a4d', flexShrink: 0 }}>GT</div>}
              <div><b>{product.name}</b><span>{product.category || 'Beauty'} · {money(product.price)} · Stock {product.stock}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" className="gt-visibility" onClick={() => startEdit(product)}>Edit</button>
              <button type="button" className={`gt-visibility ${product.is_active ? 'active' : ''}`} onClick={() => toggleProduct(product)}>{product.is_active ? 'Active' : 'Hidden'}</button>
              <button type="button" className="gt-visibility" style={{ color: '#a2382c' }} onClick={() => deleteProduct(product)}>Delete</button>
            </div>
          </div>)}{!allProducts.length && <div className="gt-empty">No products found.</div>}</div>
        </div>
      </div>}
    </div></section>
}

function PageHeading({ eyebrow, title, subtitle }) {
  return <div className="gt-page-heading"><div className="gt-eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
}

function Footer({ settings }) {
  const phone = settings.contact_phone || DEFAULT_SETTINGS.contact_phone
  return <footer className="gt-footer"><div className="gt-footer-main"><div><Link className="gt-brand gt-footer-brand" to="/"><img className="gt-logo-image" src={`${import.meta.env.BASE_URL}golden-touch-logo.jpeg`} alt="Golden Touch logo" /><span><strong>GOLDEN TOUCH</strong><small>BEAUTY · CARE · CONFIDENCE</small></span></Link><p>Beauty, care and confidence.</p></div><div><b>Explore</b><Link to="/">Home</Link><Link to="/orders">My orders</Link><Link to="/track">Track order</Link></div><div><b>Need help?</b><a href={`tel:${phone}`}><Phone size={15} /> {phone}</a><Link to="/account">My account</Link><Link to="/admin">Seller Central</Link></div></div><div className="gt-copyright">© {new Date().getFullYear()} Golden Touch. All rights reserved.</div></footer>
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
/* Golden Touch premium storefront styling */
.gt-announcement{background:#171513;color:#f7e8d1;letter-spacing:.16em;padding:10px}
.gt-header{height:90px;box-shadow:0 3px 18px #1b13090a}
.gt-brand-mark{width:48px;height:48px;border-radius:2px;background:#241e19;color:#e8c58f;border-color:#241e19}.gt-logo-image{width:54px;height:54px;object-fit:contain;display:block;flex:0 0 auto}.gt-footer-brand .gt-logo-image{width:58px;height:58px}
.gt-search{width:min(390px,30vw);border-radius:30px;background:#faf8f4;padding:12px 17px}
.gt-nav{gap:clamp(13px,2vw,27px)}
.gt-nav a{font-weight:600}
.gt-hero{background:linear-gradient(100deg,#f7f1e8 0%,#f7f1e8 48%,#eee1d0 100%);min-height:510px;padding:70px clamp(24px,9vw,140px);grid-template-columns:1fr 1.05fr}
.gt-hero h1{font-size:clamp(48px,6vw,76px);letter-spacing:-.035em}
.gt-hero-copy>p{font-size:15px;max-width:460px}
.gt-button{border-radius:2px;padding:15px 23px;text-transform:uppercase;letter-spacing:.08em;font-size:10px}
.gt-button-gold{background:#29221c}.gt-button-gold:hover{background:#a77d48}
.gt-hero-art{height:360px;background:linear-gradient(135deg,#dfcbb3,#f5ede2 55%,#cbb293);border-radius:2px;overflow:hidden;align-items:end;padding-bottom:28px;gap:28px}
.gt-art-glow{width:330px;height:330px;background:#f8f1e7;top:25px}
.gt-trust-strip{background:#fff;padding-top:25px;padding-bottom:25px}
.gt-parlour{padding:76px clamp(22px,8vw,120px);background:#211c18;color:#f8efe5}.gt-parlour-inner{max-width:1180px;margin:auto;display:grid;grid-template-columns:.9fr 1.1fr;gap:55px;align-items:center}.gt-parlour-copy h2{font:500 clamp(34px,4vw,48px)/1.15 'Playfair Display',serif;margin:18px 0;color:#fff}.gt-parlour-copy h2 em{color:#d2ad78}.gt-parlour-copy>p{font-size:14px;line-height:1.9;color:#cbbdaf}.gt-parlour-location{display:flex;align-items:center;gap:12px;margin:25px 0;color:#d2ad78}.gt-parlour-location b,.gt-parlour-location small{display:block}.gt-parlour-location b{font-size:12px;color:#f8efe5}.gt-parlour-location small{font-size:12px;color:#cbbdaf;margin-top:5px}.gt-parlour-services{border:1px solid #b58a4d66;padding:30px 34px;background:#ffffff08}.gt-parlour-services h3{font:500 27px 'Playfair Display',serif;color:#e4c18e;margin:12px 0 18px}.gt-parlour-services ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:0 25px}.gt-parlour-services li{font-size:12px;line-height:1.6;color:#eee1d2;padding:12px 0;border-bottom:1px solid #ffffff20}.gt-parlour-services li:before{content:'✦';color:#d2ad78;margin-right:9px}.gt-parlour .gt-eyebrow{color:#d2ad78}.gt-parlour .gt-button{margin-top:5px}.gt-section{padding-top:82px;padding-bottom:82px}
.gt-section-heading h2,.gt-why h2{font-size:clamp(32px,3.4vw,43px)}
.gt-product-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}
.gt-product-card{border:0;background:#faf8f5;transition:transform .2s,box-shadow .2s}
.gt-product-card:hover{transform:translateY(-4px);box-shadow:0 14px 35px #2b21150d}
.gt-product-image{height:260px;background:#f0e9df}
.gt-product-image img{transition:transform .35s}
.gt-product-card:hover .gt-product-image img{transform:scale(1.045)}
.gt-product-details{padding:18px}
.gt-product-details h3{font-size:18px}
.gt-product-bottom strong{font-size:15px;color:#9a713f}
.gt-product-bottom button{background:#29221c;color:white;border-color:#29221c;text-transform:uppercase;letter-spacing:.07em}
.gt-why{background:#f5f0e8}.gt-why-grid article{background:#fff;padding:28px 20px}
.gt-footer{background:#211c18}
@media(max-width:1050px){.gt-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.gt-header{height:78px}}
@media(max-width:760px){.gt-parlour{padding:52px 20px}.gt-parlour-inner{grid-template-columns:1fr;gap:30px}.gt-parlour-services{padding:23px 20px}.gt-parlour-services ul{grid-template-columns:1fr}.gt-header{height:70px}.gt-hero{grid-template-columns:1fr;padding:44px 22px 28px;min-height:0}.gt-hero-art{height:260px}.gt-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gt-product-image{height:175px}.gt-section{padding:54px 17px}}
@media(max-width:420px){.gt-product-image{height:145px}.gt-product-details{padding:11px}}
/* Carnesia-inspired browsing features with original Golden Touch identity */
.gt-hero-slider{position:relative}.gt-hero-copy{animation:gt-fade-in .45s ease}.gt-slider-controls{display:flex;gap:8px;margin-top:24px}.gt-slider-controls button{width:28px;height:4px;border:0;background:#c9bba9;padding:0;cursor:pointer}.gt-slider-controls button.active{width:48px;background:#9a713f}.gt-promise-row{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;padding:20px clamp(20px,8vw,120px);border-bottom:1px solid var(--gt-line);background:#fff}.gt-promise-row span{display:flex;align-items:center;justify-content:center;gap:9px;color:#6e6257;font-size:11px}.gt-promise-row svg{width:18px;height:18px;color:#a77d48}.gt-category-section{padding:35px clamp(20px,8vw,120px) 26px;background:#faf8f4}.gt-category-heading{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:18px}.gt-category-heading h2{font:500 27px 'Playfair Display',serif;margin:8px 0 0}.gt-category-heading>a{display:flex;align-items:center;gap:6px;color:#8f6735;text-decoration:none;font-size:11px}.gt-category-scroller{display:flex;gap:10px;overflow-x:auto;padding:2px 1px 10px;scroll-snap-type:x mandatory}.gt-category-scroller button{flex:0 0 auto;display:flex;align-items:center;gap:9px;border:1px solid #e5dbce;background:white;padding:12px 17px;color:#65584d;font:600 11px 'DM Sans';cursor:pointer;scroll-snap-align:start;transition:.2s}.gt-category-scroller button.active,.gt-category-scroller button:hover{background:#29221c;border-color:#29221c;color:white}.gt-category-scroller button svg{width:13px}.gt-section-products-top{scroll-margin-top:105px}.gt-product-card{overflow:hidden}.gt-product-bottom button:hover:not(:disabled){background:#a77d48;border-color:#a77d48}.gt-header{backdrop-filter:blur(14px)}.gt-nav a{position:relative}.gt-nav a.active:after{content:'';position:absolute;left:0;right:0;bottom:-9px;height:2px;background:#b58a4d}@keyframes gt-fade-in{from{opacity:.35;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}@media(max-width:760px){.gt-promise-row{grid-template-columns:repeat(2,1fr);padding:17px 14px;gap:14px}.gt-promise-row span{justify-content:flex-start;font-size:10px}.gt-category-section{padding:28px 17px 18px}.gt-category-heading h2{font-size:23px}.gt-category-scroller button{padding:11px 14px}.gt-hero-copy{animation:none}}

`

export default App
