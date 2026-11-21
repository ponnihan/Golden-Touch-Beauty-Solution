import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://loyzzvrflfhndfnnppgf.supabase.co';
// Publishable/anon key is intended for browser use. Row-level security protects the data.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_AuzsfN9xSL-Z3iUkXOqULA_Ezqwe-DH';
const ADMIN_EMAIL = 'ponni171196@gmail.com';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const authState = document.getElementById('authState');
const reportActions = document.getElementById('reportActions');
const resultState = document.getElementById('resultState');
const buttonIds = ['ordersBtn', 'productsBtn', 'inventoryBtn'];

function setMessage(message, kind = '') {
  authState.textContent = message;
  authState.className = `state ${kind}`.trim();
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Stop spreadsheet formula injection from customer-entered strings.
  if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = '\uFEFF' + [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchAllRows(table, columns, orderColumn) {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

async function requireAdmin() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return false;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  return String(userData.user?.email || '').toLowerCase() === ADMIN_EMAIL;
}

async function withBusy(buttonId, task) {
  const buttons = buttonIds.map((id) => document.getElementById(id));
  buttons.forEach((button) => { button.disabled = true; });
  const activeButton = document.getElementById(buttonId);
  const oldText = activeButton.textContent;
  activeButton.textContent = 'Preparing CSV…';
  resultState.textContent = '';
  try {
    await task();
  } catch (error) {
    resultState.textContent = error?.message || 'CSV export failed. Please refresh and try again.';
    resultState.className = 'state error';
  } finally {
    activeButton.textContent = oldText;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function exportOrders() {
  const orders = await fetchAllRows(
    'orders',
    'id,tracking_code,created_at,customer_name,phone,address,division,district,items,subtotal,delivery_charge,total,payment_method,transaction_id,notes,status,updated_at',
    'created_at',
  );
  const headers = [
    'Order ID', 'Tracking Code', 'Created At', 'Customer Name', 'Phone', 'Address',
    'Division', 'District', 'Items', 'Subtotal BDT', 'Delivery Charge BDT', 'Total BDT',
    'Payment Method', 'Transaction ID', 'Notes', 'Status', 'Updated At',
  ];
  const rows = orders.map((order) => {
    let items = order.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    const itemSummary = Array.isArray(items)
      ? items.map((item) => `${item.product_name || item.name || 'Product'} x ${item.quantity || item.qty || 0}`).join(' | ')
      : '';
    return [
      order.id, order.tracking_code, order.created_at, order.customer_name, order.phone,
      order.address, order.division, order.district, itemSummary, order.subtotal,
      order.delivery_charge, order.total, order.payment_method, order.transaction_id,
      order.notes, order.status, order.updated_at,
    ];
  });
  downloadCsv(`golden-touch-order-report-${dateStamp()}.csv`, headers, rows);
  resultState.textContent = `Downloaded ${orders.length} order record(s).`;
}

async function loadProducts() {
  return fetchAllRows(
    'products',
    'id,name,category,description,price,stock,is_active,image_url,created_at',
    'created_at',
  );
}

async function exportProducts() {
  const products = await loadProducts();
  const headers = [
    'Product ID', 'Product Name', 'Category', 'Description', 'Unit Price BDT',
    'Stock Units', 'Active', 'Estimated Retail Stock Value BDT', 'Image URL', 'Created At',
  ];
  const rows = products.map((product) => [
    product.id, product.name, product.category, product.description, product.price,
    product.stock, product.is_active ? 'Yes' : 'No',
    Number(product.price || 0) * Number(product.stock || 0), product.image_url, product.created_at,
  ]);
  downloadCsv(`golden-touch-product-management-${dateStamp()}.csv`, headers, rows);
  resultState.textContent = `Downloaded ${products.length} product record(s).`;
}

async function exportInventory() {
  const products = await loadProducts();
  const headers = [
    'Record Type', 'Product ID', 'Product Name', 'Category', 'Stock Units',
    'Unit Price BDT', 'Estimated Retail Stock Value BDT', 'Status',
  ];
  const rows = products.map((product) => [
    'PRODUCT', product.id, product.name, product.category, Number(product.stock || 0),
    Number(product.price || 0), Number(product.price || 0) * Number(product.stock || 0),
    product.is_active ? 'Active' : 'Hidden',
  ]);
  const totalUnits = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const estimatedRetailValue = products.reduce(
    (sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0,
  );
  rows.push(['TOTAL', '', 'ALL PRODUCTS', '', totalUnits, '', estimatedRetailValue, `${products.length} products`]);
  downloadCsv(`golden-touch-total-inventory-${dateStamp()}.csv`, headers, rows);
  resultState.textContent = `Downloaded inventory: ${totalUnits} units across ${products.length} products; estimated retail value ৳${estimatedRetailValue.toLocaleString('en-BD')}.`;
}

async function initialise() {
  reportActions.hidden = true;
  setMessage('Checking administrator session…');
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      setMessage('Admin sign-in required. Open Seller Central, sign in with the administrator account in this same browser, then return here and press Refresh session.', 'error');
      return;
    }
    setMessage(`Verified administrator: ${ADMIN_EMAIL}. CSV exports are read-only.`, 'ok');
    reportActions.hidden = false;
  } catch (error) {
    setMessage(`Could not verify the administrator session: ${error?.message || 'Unknown error'}`, 'error');
  }
}

document.getElementById('refreshBtn').addEventListener('click', initialise);
document.getElementById('ordersBtn').addEventListener('click', () => withBusy('ordersBtn', exportOrders));
document.getElementById('productsBtn').addEventListener('click', () => withBusy('productsBtn', exportProducts));
document.getElementById('inventoryBtn').addEventListener('click', () => withBusy('inventoryBtn', exportInventory));

initialise();
