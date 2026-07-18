/* ============================================================
   App Module — Dashboard logic, SPA navigation, charts, data
   All data comes from real API calls (no demo data).
   ============================================================ */

const App = {
  currentPage: 'dashboard',
  user: null,

  /* ── Initialize ── */
  async init() {
    // Auth guard
    if (!Auth.guard()) return;

    // Load user
    try {
      this.user = await Auth.getUser();
      localStorage.setItem('erp_user', JSON.stringify(this.user));
      this.renderUserInfo();
    } catch {
      Auth.logout();
      return;
    }

    // Lucide icons
    lucide.createIcons();

    // Load dashboard data
    this.loadDashboard();
  },

  /* ── Render User Info ── */
  renderUserInfo() {
    if (!this.user) return;
    const name = this.user.full_name || this.user.email || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const role = this.user.role || 'Employee';

    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = name;
    document.getElementById('userRole').textContent = role;

    // Settings page
    const settingsName = document.getElementById('settingsName');
    if (settingsName) settingsName.value = name;
    const settingsEmail = document.getElementById('settingsEmail');
    if (settingsEmail) settingsEmail.value = this.user.email || '';
    const settingsRole = document.getElementById('settingsRole');
    if (settingsRole) settingsRole.value = role;
    const settingsStatus = document.getElementById('settingsStatus');
    if (settingsStatus) settingsStatus.value = this.user.is_active ? 'Active' : 'Inactive';
  },

  /* ══════════════════════════════════════
     NAVIGATION
     ══════════════════════════════════════ */
  navigate(page) {
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Show/hide sections
    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.remove('active');
    });
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    // Update title
    const titles = {
      dashboard: 'Dashboard',
      inventory: 'Inventory',
      sales: 'Sales',
      crm: 'CRM',
      finance: 'Finance',
      hr: 'Human Resources',
      settings: 'Settings',
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    document.title = `QuantURP — ${titles[page] || page}`;

    this.currentPage = page;
    this.closeSidebar();

    // Load page data
    this.loadPageData(page);
  },

  loadPageData(page) {
    switch (page) {
      case 'dashboard':  this.loadDashboard();  break;
      case 'inventory':  this.loadInventory();   break;
      case 'sales':      this.loadSales();       break;
      case 'crm':        this.loadCRM();         break;
      case 'finance':    this.loadFinance();     break;
      case 'hr':         this.loadHR();          break;
    }
  },

  refreshCurrentPage() {
    this.loadPageData(this.currentPage);
    this.showToast('Refreshed', 'info');
  },

  /* ══════════════════════════════════════
     SIDEBAR
     ══════════════════════════════════════ */
  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  },

  /* ══════════════════════════════════════
     DATA LOADING — Real API calls
     ══════════════════════════════════════ */

  async loadDashboard() {
    // Try to load dashboard summary data from API endpoints
    // These endpoints may or may not exist yet
    let orders = [], products = [], customers = [], transactions = [];

    try { orders = await Auth.apiFetch('/orders'); } catch {}
    try { products = await Auth.apiFetch('/products'); } catch {}
    try { customers = await Auth.apiFetch('/customers'); } catch {}
    try { transactions = await Auth.apiFetch('/transactions'); } catch {}

    // Ensure arrays
    orders = Array.isArray(orders) ? orders : [];
    products = Array.isArray(products) ? products : [];
    customers = Array.isArray(customers) ? customers : [];
    transactions = Array.isArray(transactions) ? transactions : [];

    // Revenue
    const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const income = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + (t.amount || 0), 0);
    const totalRevenue = revenue || income;

    this.animateCounter('statRevenue', totalRevenue, '₹');
    this.animateCounter('statOrders', orders.length);
    this.animateCounter('statCustomers', customers.length);
    this.animateCounter('statProducts', products.length);

    // Recent orders table
    this.renderRecentOrders(orders);

    // Charts
    this.drawRevenueChart(orders, transactions);
    this.drawOrderStatusChart(orders);
  },

  async loadInventory() {
    let products = [], categories = [], warehouses = [], stocks = [];

    try { products = await Auth.apiFetch('/products'); } catch {}
    try { categories = await Auth.apiFetch('/categories'); } catch {}
    try { warehouses = await Auth.apiFetch('/warehouses'); } catch {}
    try { stocks = await Auth.apiFetch('/stocks'); } catch {}

    products = Array.isArray(products) ? products : [];
    categories = Array.isArray(categories) ? categories : [];
    warehouses = Array.isArray(warehouses) ? warehouses : [];
    stocks = Array.isArray(stocks) ? stocks : [];

    const lowStock = stocks.filter(s => s.quantity < 10).length;

    this.animateCounter('invTotalProducts', products.length);
    this.animateCounter('invWarehouses', warehouses.length);
    this.animateCounter('invCategories', categories.length);
    this.animateCounter('invLowStock', lowStock);

    const tbody = document.getElementById('inventoryBody');
    const emptyState = document.getElementById('inventoryEmpty');

    if (products.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
      tbody.innerHTML = products.map(p => {
        const stock = stocks.find(s => s.product_id === p.id);
        const qty = stock ? stock.quantity : '—';
        const cat = categories.find(c => c.id === p.category_id);
        return `<tr>
          <td><strong>${this.esc(p.sku)}</strong></td>
          <td>${this.esc(p.name)}</td>
          <td>${cat ? this.esc(cat.name) : '—'}</td>
          <td>₹${(p.price || 0).toLocaleString('en-IN')}</td>
          <td>₹${(p.cost || 0).toLocaleString('en-IN')}</td>
          <td>${qty}</td>
        </tr>`;
      }).join('');
    }
  },

  async loadSales() {
    let orders = [], customers = [];

    try { orders = await Auth.apiFetch('/orders'); } catch {}
    try { customers = await Auth.apiFetch('/customers'); } catch {}

    orders = Array.isArray(orders) ? orders : [];
    customers = Array.isArray(customers) ? customers : [];

    const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const pending = orders.filter(o => o.status === 'Pending').length;
    const delivered = orders.filter(o => o.status === 'Delivered').length;

    this.animateCounter('salesTotalRevenue', revenue, '₹');
    this.animateCounter('salesTotalOrders', orders.length);
    this.animateCounter('salesPending', pending);
    this.animateCounter('salesDelivered', delivered);

    const tbody = document.getElementById('salesBody');
    const emptyState = document.getElementById('salesEmpty');

    if (orders.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
      tbody.innerHTML = orders.map(o => {
        const customer = customers.find(c => c.id === o.customer_id);
        const badge = this.statusBadge(o.status);
        const items = o.items ? o.items.length : '—';
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—';
        return `<tr>
          <td><strong>#${o.id}</strong></td>
          <td>${customer ? this.esc(customer.name) : 'Customer #' + o.customer_id}</td>
          <td>${items}</td>
          <td>₹${(o.total_amount || 0).toLocaleString('en-IN')}</td>
          <td>${badge}</td>
          <td>${date}</td>
        </tr>`;
      }).join('');
    }
  },

  async loadCRM() {
    let leads = [];

    try { leads = await Auth.apiFetch('/leads'); } catch {}

    leads = Array.isArray(leads) ? leads : [];

    const qualified = leads.filter(l => l.status === 'Qualified').length;
    const contacted = leads.filter(l => l.status === 'Contacted').length;
    const converted = leads.filter(l => l.status === 'Converted').length;

    this.animateCounter('crmTotalLeads', leads.length);
    this.animateCounter('crmQualified', qualified);
    this.animateCounter('crmContacted', contacted);
    this.animateCounter('crmConverted', converted);

    const tbody = document.getElementById('crmBody');
    const emptyState = document.getElementById('crmEmpty');

    if (leads.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
      tbody.innerHTML = leads.map(l => {
        const badge = this.leadBadge(l.status);
        const date = l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : '—';
        return `<tr>
          <td><strong>${this.esc(l.name)}</strong></td>
          <td>${this.esc(l.company || '—')}</td>
          <td>${this.esc(l.email || '—')}</td>
          <td>${this.esc(l.phone || '—')}</td>
          <td>${badge}</td>
          <td>${date}</td>
        </tr>`;
      }).join('');
    }
  },

  async loadFinance() {
    let transactions = [];

    try { transactions = await Auth.apiFetch('/transactions'); } catch {}

    transactions = Array.isArray(transactions) ? transactions : [];

    const income = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + (t.amount || 0), 0);
    const expense = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + (t.amount || 0), 0);

    this.animateCounter('finIncome', income, '₹');
    this.animateCounter('finExpense', expense, '₹');
    this.animateCounter('finBalance', income - expense, '₹');
    this.animateCounter('finTransactions', transactions.length);

    const tbody = document.getElementById('financeBody');
    const emptyState = document.getElementById('financeEmpty');

    if (transactions.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
      tbody.innerHTML = transactions.map(t => {
        const typeBadge = t.type === 'Income'
          ? '<span class="badge badge-green">Income</span>'
          : '<span class="badge badge-red">Expense</span>';
        const date = t.transaction_date || '—';
        return `<tr>
          <td>#${t.id}</td>
          <td>${typeBadge}</td>
          <td>${this.esc(t.description || '—')}</td>
          <td>₹${(t.amount || 0).toLocaleString('en-IN')}</td>
          <td>${date}</td>
        </tr>`;
      }).join('');
    }
  },

  async loadHR() {
    let employees = [], leaves = [];

    try { employees = await Auth.apiFetch('/employees'); } catch {}
    try { leaves = await Auth.apiFetch('/leaves'); } catch {}

    employees = Array.isArray(employees) ? employees : [];
    leaves = Array.isArray(leaves) ? leaves : [];

    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    const pendingLeaves = leaves.filter(l => l.status === 'Pending').length;
    const payroll = employees.reduce((s, e) => s + (e.salary || 0), 0);

    this.animateCounter('hrEmployees', employees.length);
    this.animateCounter('hrDepartments', depts.size);
    this.animateCounter('hrPendingLeaves', pendingLeaves);
    this.animateCounter('hrPayroll', payroll, '₹');

    // Employees table
    const tbody = document.getElementById('hrBody');
    const emptyState = document.getElementById('hrEmpty');

    if (employees.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
      tbody.innerHTML = employees.map(e => {
        const joinDate = e.joining_date || '—';
        return `<tr>
          <td><strong>${this.esc(e.user?.full_name || 'Employee #' + e.id)}</strong></td>
          <td>${this.esc(e.department || '—')}</td>
          <td>${this.esc(e.designation || '—')}</td>
          <td>${joinDate}</td>
          <td>₹${(e.salary || 0).toLocaleString('en-IN')}</td>
        </tr>`;
      }).join('');
    }

    // Leaves table
    const leavesTbody = document.getElementById('leavesBody');
    const leavesEmpty = document.getElementById('leavesEmpty');

    if (leaves.length === 0) {
      leavesTbody.innerHTML = '';
      leavesEmpty.style.display = 'flex';
    } else {
      leavesEmpty.style.display = 'none';
      leavesTbody.innerHTML = leaves.map(l => {
        const badge = this.leaveBadge(l.status);
        return `<tr>
          <td>Employee #${l.employee_id}</td>
          <td>${this.esc(l.leave_type || '—')}</td>
          <td>${l.start_date || '—'}</td>
          <td>${l.end_date || '—'}</td>
          <td>${this.esc(l.reason || '—')}</td>
          <td>${badge}</td>
        </tr>`;
      }).join('');
    }
  },

  /* ══════════════════════════════════════
     RENDERING HELPERS
     ══════════════════════════════════════ */

  renderRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersBody');
    const emptyState = document.getElementById('dashboardOrdersEmpty');

    if (!orders.length) {
      tbody.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';
    const recent = orders.slice(-10).reverse();
    tbody.innerHTML = recent.map(o => {
      const badge = this.statusBadge(o.status);
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '—';
      return `<tr>
        <td><strong>#${o.id}</strong></td>
        <td>Customer #${o.customer_id}</td>
        <td>₹${(o.total_amount || 0).toLocaleString('en-IN')}</td>
        <td>${badge}</td>
        <td>${date}</td>
      </tr>`;
    }).join('');
  },

  statusBadge(status) {
    const map = {
      'Pending':    'badge-orange',
      'Processing': 'badge-blue',
      'Shipped':    'badge-blue',
      'Delivered':  'badge-green',
      'Cancelled':  'badge-red',
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${status || 'Unknown'}</span>`;
  },

  leadBadge(status) {
    const map = {
      'New':       'badge-blue',
      'Contacted': 'badge-orange',
      'Qualified': 'badge-green',
      'Converted': 'badge-green',
      'Lost':      'badge-red',
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${status || 'Unknown'}</span>`;
  },

  leaveBadge(status) {
    const map = {
      'Pending':  'badge-orange',
      'Approved': 'badge-green',
      'Rejected': 'badge-red',
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${status || 'Unknown'}</span>`;
  },

  /* ══════════════════════════════════════
     ANIMATED COUNTER
     ══════════════════════════════════════ */
  animateCounter(elementId, target, prefix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = 800;
    const start = performance.now();
    const from = 0;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * ease);

      if (prefix === '₹') {
        el.textContent = '₹' + current.toLocaleString('en-IN');
      } else {
        el.textContent = prefix + current.toLocaleString('en-IN');
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  },

  /* ══════════════════════════════════════
     CHARTS (Canvas-based, no libraries)
     ══════════════════════════════════════ */
  drawRevenueChart(orders, transactions) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };

    // Build monthly data from orders or transactions
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = new Array(12).fill(0);

    orders.forEach(o => {
      if (o.created_at) {
        const d = new Date(o.created_at);
        monthlyData[d.getMonth()] += o.total_amount || 0;
      }
    });

    transactions.forEach(t => {
      if (t.type === 'Income' && t.transaction_date) {
        const d = new Date(t.transaction_date);
        monthlyData[d.getMonth()] += t.amount || 0;
      }
    });

    const maxVal = Math.max(...monthlyData, 1);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (h - padding.top - padding.bottom) * (1 - i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Y labels
      ctx.fillStyle = '#9E9E9E';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      const label = Math.round(maxVal * i / 4);
      ctx.fillText('₹' + label.toLocaleString('en-IN'), padding.left - 8, y + 4);
    }

    // Data area
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, 'rgba(0, 200, 83, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 200, 83, 0)');

    // Draw area
    ctx.beginPath();
    months.forEach((_, i) => {
      const x = padding.left + (i / 11) * chartW;
      const y = padding.top + chartH - (monthlyData[i] / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    // Close fill
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    months.forEach((_, i) => {
      const x = padding.left + (i / 11) * chartW;
      const y = padding.top + chartH - (monthlyData[i] / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00C853';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    months.forEach((_, i) => {
      const x = padding.left + (i / 11) * chartW;
      const y = padding.top + chartH - (monthlyData[i] / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00C853';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // X labels
    ctx.fillStyle = '#9E9E9E';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    months.forEach((m, i) => {
      const x = padding.left + (i / 11) * chartW;
      ctx.fillText(m, x, h - padding.bottom + 20);
    });
  },

  drawOrderStatusChart(orders) {
    const canvas = document.getElementById('orderStatusChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2 - 10;
    const radius = Math.min(w, h) / 2 - 40;

    ctx.clearRect(0, 0, w, h);

    // Count statuses
    const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    const colors = ['#FFA726', '#42A5F5', '#26C6DA', '#66BB6A', '#EF5350'];
    const counts = statuses.map(s => orders.filter(o => o.status === s).length);
    const total = counts.reduce((a, b) => a + b, 0);

    if (total === 0) {
      // Draw empty state donut
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#EEEEEE';
      ctx.lineWidth = 24;
      ctx.stroke();

      ctx.fillStyle = '#9E9E9E';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No orders data', cx, cy + 4);
      return;
    }

    // Draw donut
    let startAngle = -Math.PI / 2;
    counts.forEach((count, i) => {
      if (count === 0) return;
      const sliceAngle = (count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 24;
      ctx.lineCap = 'butt';
      ctx.stroke();
      startAngle += sliceAngle;
    });

    // Center text
    ctx.fillStyle = '#212121';
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(total, cx, cy + 2);
    ctx.fillStyle = '#9E9E9E';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Total', cx, cy + 18);

    // Legend
    let legendY = cy + radius + 30;
    const legendX = 20;
    statuses.forEach((s, i) => {
      if (counts[i] === 0) return;
      ctx.fillStyle = colors[i];
      ctx.fillRect(legendX, legendY - 8, 10, 10);
      ctx.fillStyle = '#616161';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${s} (${counts[i]})`, legendX + 16, legendY);
      legendY += 18;
    });
  },

  /* ══════════════════════════════════════
     TABLE FILTER
     ══════════════════════════════════════ */
  filterTable(tbodyId, query) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    const q = query.toLowerCase();
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  },

  /* ══════════════════════════════════════
     MODALS
     ══════════════════════════════════════ */
  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show');
  },

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
  },

  /* ══════════════════════════════════════
     FORM SUBMIT (to real API)
     ══════════════════════════════════════ */
  async submitForm(formId, endpoint, reloadPage) {
    const form = document.getElementById(formId);
    if (!form) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Convert numeric fields
    ['price', 'cost', 'amount', 'salary', 'total_amount', 'quantity', 'probability', 'expected_value'].forEach(key => {
      if (data[key]) data[key] = parseFloat(data[key]);
    });

    try {
      await Auth.apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      this.showToast('Created successfully!', 'success');
      form.reset();
      // Close any open modal
      document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
      // Reload page data
      if (reloadPage) this.loadPageData(reloadPage);
    } catch (err) {
      this.showToast(err.message || 'Failed to save. Backend endpoint may not be available yet.', 'error');
    }
  },

  /* ══════════════════════════════════════
     TOAST
     ══════════════════════════════════════ */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${this.esc(message)}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  /* ══════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════ */
  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};


/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => App.init());
