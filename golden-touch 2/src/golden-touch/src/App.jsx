{ session, authReady, products, refreshProducts }) {
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [allProducts, setAllProducts] = useState(products)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const emptyProduct = { name: '', category: '', description: '', price: '', stock: '0', image_url: '' }
  const [newProduct, setNewProduct] = useState(emptyProduct)
  const [editingId, setEditingId] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)

  const isAdmin = Boolean(
    session?.user?.email &&
    session.user.email.toLowerCase() === String(ADMIN_EMAIL || '').toLowerCase()
  )

  async function refresh() {
    if (!isAdmin) return
    setBusy(true)
    setError('')

    const [orderResult, productResult] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
    ])

    if (orderResult.error) setError(orderResult.error.message)
    if (productResult.error) {
      setError((current) => current
        ? `${current} · ${productResult.error.message}`
        : productResult.error.message)
    }

    setOrders(orderResult.data || [])
    setAllProducts(productResult.data || [])
    setBusy(false)
  }

  useEffect(() => {
    if (isAdmin) refresh()
  }, [isAdmin])

  function resetProductForm() {
    setNewProduct(emptyProduct)
    setEditingId(null)
    setSelectedImage(null)
  }

  async function updateStatus(id, status) {
    setNotice('')
    setError('')
    const { error: rpcError } = await supabase.rpc('admin_set_order_status', {
      p_order_id: id,
      p_status: status,
      p_note: '',
    })

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setNotice('Order status updated.')
    refresh()
  }

  async function uploadProductImage(file) {
    if (!file) return
    setError('')
    setNotice('')

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.')
      return
    }

    setUploading(true)

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const filePath = `products/${crypto.randomUUID()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('Product Image')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('Product Image')
        .getPublicUrl(filePath)

      if (!data?.publicUrl) {
        throw new Error('Could not create the public image URL.')
      }

      setNewProduct((current) => ({
        ...current,
        image_url: data.publicUrl,
      }))
      setNotice('Image uploaded. Save the product to apply it.')
    } catch (uploadError) {
      setError(uploadError.message || 'Image upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function saveProduct(event) {
    event.preventDefault()
    setNotice('')
    setError('')

    const price = Number(newProduct.price)
    const stock = Number(newProduct.stock)

    if (!newProduct.name.trim()) {
      setError('Product name is required.')
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid product price.')
      return
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError('Stock must be a whole number of zero or more.')
      return
    }

    const payload = {
      name: newProduct.name.trim(),
      category: newProduct.category.trim() || null,
      description: newProduct.description.trim() || null,
      price,
      stock,
      image_url: newProduct.image_url.trim() || null,
    }

    setBusy(true)

    const result = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert({ ...payload, is_active: true })

    setBusy(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    setNotice(editingId ? 'Product updated successfully.' : 'Product added successfully.')
    resetProductForm()
    await refresh()
    refreshProducts?.()
  }

  function startEditing(product) {
    setNewProduct({
      name: product.name || '',
      category: product.category || '',
      description: product.description || '',
      price: String(product.price ?? ''),
      stock: String(product.stock ?? 0),
      image_url: product.image_url || '',
    })
    setEditingId(product.id)
    setSelectedImage(null)
    setNotice('')
    setError('')
    setTab('products')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(
      `Delete "${product.name}" permanently? This cannot be undone.`
    )
    if (!confirmed) return

    setNotice('')
    setError('')
    setBusy(true)

    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id)

    setBusy(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    if (editingId === product.id) resetProductForm()

    setNotice('Product deleted.')
    await refresh()
    refreshProducts?.()
  }

  async function toggleProduct(product) {
    setNotice('')
    setError('')

    const { error: updateError } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setNotice('Product visibility updated.')
      await refresh()
      refreshProducts?.()
    }
  }

  if (!authReady) {
    return <section className="gt-page"><div className="gt-empty">Loading admin access…</div></section>
  }

  if (!session?.user) {
    return (
      <section className="gt-page gt-narrow">
        <div className="gt-empty-panel">
          <ShieldCheck size={40} />
          <h2>Seller Central</h2>
          <p>Sign in with your administrator account to manage Golden Touch.</p>
          <Link className="gt-button gt-button-gold" to="/account">Admin sign in</Link>
        </div>
      </section>
    )
  }

  if (!isAdmin) {
    return (
      <section className="gt-page gt-narrow">
        <div className="gt-empty-panel">
          <ShieldCheck size={40} />
          <h2>Admin access only</h2>
          <p>This account is not authorized to open the store dashboard.</p>
          <button className="gt-button gt-button-outline-dark" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="gt-admin-page">
      <aside className="gt-admin-sidebar">
        <div className="gt-admin-brand">
          <LayoutDashboard />
          <span><b>GOLDEN TOUCH</b><small>SELLER DESK</small></span>
        </div>
        <button className={tab === 'orders' ? 'selected' : ''} onClick={() => setTab('orders')}>
          <ClipboardList /> Orders
        </button>
        <button className={tab === 'products' ? 'selected' : ''} onClick={() => setTab('products')}>
          <Package /> Products
        </button>
        <div className="gt-admin-side-foot">
          Signed in as admin
          <button onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <div className="gt-admin-main">
        <div className="gt-admin-top">
          <div>
            <span>Golden Touch / Seller Desk</span>
            <h1>{tab === 'orders' ? 'Manage orders' : 'Manage products'}</h1>
          </div>
          <button className="gt-button gt-button-outline-dark" onClick={refresh}>
            Refresh data
          </button>
        </div>

        {notice && <div className="gt-success-message">{notice}</div>}
        {error && <div className="gt-error" role="alert">{error}</div>}
        {busy && <div className="gt-empty">Working…</div>}

        {tab === 'orders' ? (
          <div className="gt-admin-panel">
            <div className="gt-admin-panel-head">
              <h2>All orders</h2>
              <span>{orders.length} total</span>
            </div>
            {orders.length ? (
              <div className="gt-table-wrap">
                <table className="gt-table">
                  <thead>
                    <tr>
                      <th>Order</th><th>Customer</th><th>Phone</th>
                      <th>Total</th><th>Current status</th><th>Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <b>#{shortId(order.id)}</b>
                          <small>{order.tracking_code || 'No tracking code'}</small>
                          <small>{dateTime(order.created_at)}</small>
                        </td>
                        <td>{order.customer_name}</td>
                        <td>{order.phone}</td>
                        <td>{money(order.total)}</td>
                        <td>
                          <span className={`gt-status status-${order.status}`}>
                            {String(order.status).replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <select
                            aria-label={`Update status for order ${shortId(order.id)}`}
                            value={order.status}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status.replaceAll('_', ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="gt-empty">No orders yet.</div>}
          </div>
        ) : (
          <div className="gt-admin-products-grid">
            <form className="gt-admin-panel gt-form-stack" onSubmit={saveProduct}>
              <h2>{editingId ? 'Edit product' : 'Add a product'}</h2>

              <label>
                Product name
                <input
                  required
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                />
              </label>

              <label>
                Category
                <input
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                />
              </label>

              <label>
                Description
                <textarea
                  rows={3}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </label>

              <div className="gt-two-fields">
                <label>
                  Price (BDT)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  />
                </label>
                <label>
                  Stock
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Upload product image (maximum 5 MB)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setSelectedImage(file)
                    if (file) uploadProductImage(file)
                  }}
                />
              </label>

              {selectedImage && (
                <p className="gt-small-note">Selected: {selectedImage.name}</p>
              )}

              {newProduct.image_url && (
                <div>
                  <p className="gt-small-note">Image preview</p>
                  <img
                    src={newProduct.image_url}
                    alt="Product preview"
                    style={{
                      width: '100%',
                      maxWidth: '220px',
                      height: '160px',
                      objectFit: 'cover',
                      border: '1px solid #e9e1d6',
                    }}
                  />
                </div>
              )}

              {uploading && <div className="gt-small-note">Uploading image…</div>}

              <label>
                Or paste an image URL
                <input
                  type="url"
                  value={newProduct.image_url}
                  onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </label>

              <button
                className="gt-button gt-button-gold gt-full"
                type="submit"
                disabled={busy || uploading}
              >
                {busy ? 'Saving…' : editingId ? 'Save product changes' : 'Add product'}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="gt-button gt-button-outline-dark gt-full"
                  onClick={resetProductForm}
                >
                  Cancel editing
                </button>
              )}
            </form>

            <div className="gt-admin-panel">
              <div className="gt-admin-panel-head">
                <h2>Product catalogue</h2>
                <span>{allProducts.length} items</span>
              </div>

              <div className="gt-admin-product-list">
                {allProducts.map((product) => (
                  <div key={product.id} className="gt-admin-product-row">
                    <div className="gt-admin-product-info">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="gt-admin-product-thumb"
                        />
                      ) : (
                        <div className="gt-admin-product-thumb gt-admin-no-image">
                          <Package size={18} />
                        </div>
                      )}
                      <div>
                        <b>{product.name}</b>
                        <span>
                          {product.category || 'Beauty'} · {money(product.price)} · Stock {product.stock}
                        </span>
                      </div>
                    </div>

                    <div className="gt-admin-product-actions">
                      <button
                        type="button"
                        className="gt-button gt-button-outline-dark"
                        onClick={() => startEditing(product)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`gt-visibility ${product.is_active ? 'active' : ''}`}
                        onClick={() => toggleProduct(product)}
                      >
                        {product.is_active ? 'Active' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        className="gt-visibility gt-delete-button"
                        onClick={() => deleteProduct(product)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!allProducts.length && <div className="gt-empty">No products found.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
