(function () {
  'use strict';

  let token = localStorage.getItem('admin_token') || '';
  let currentPage = 'dashboard';

  // ── API Client ──
  const api = {
    async get(path) {
      const res = await fetch(`/api${path}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
    async post(path, body) {
      const res = await fetch(`/api${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
    async put(path, body) {
      const res = await fetch(`/api${path}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
    async del(path) {
      const res = await fetch(`/api${path}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      return res.json();
    },
  };

  // ── Helpers ──
  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function showModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  // ── Auth ──
  async function login() {
    const input = document.getElementById('token-input');
    const err = document.getElementById('login-error');
    token = input.value.trim();
    if (!token) { err.textContent = 'Please enter a token'; err.classList.remove('hidden'); return; }
    try {
      await api.get('/stats');
      localStorage.setItem('admin_token', token);
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      navigate('dashboard');
    } catch (e) {
      err.textContent = 'Invalid token';
      err.classList.remove('hidden');
      token = '';
    }
  }

  function logout() {
    token = '';
    localStorage.removeItem('admin_token');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('token-input').value = '';
    document.getElementById('login-error').classList.add('hidden');
  }

  async function checkAuth() {
    if (!token) return;
    try {
      await api.get('/stats');
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      const page = location.hash.slice(1) || 'dashboard';
      navigate(page);
    } catch (e) {
      token = '';
      localStorage.removeItem('admin_token');
    }
  }

  // ── Router ──
  function navigate(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const target = document.getElementById(`page-${page}`);
    const link = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (target) target.classList.remove('hidden');
    if (link) link.classList.add('active');

    location.hash = page;

    const renderers = { dashboard: renderDashboard, users: renderUsers, settings: renderSettings, subscriptions: renderSubscriptions, broadcast: renderBroadcast, schedule: renderSchedule, leaderboard: renderLeaderboard, homework: renderHomework, contests: renderContests };
    if (renderers[page]) renderers[page]();
  }

  // ── Dashboard ──
  async function renderDashboard() {
    const el = document.getElementById('page-dashboard');
    el.innerHTML = '<p class="text-muted">Loading...</p>';
    try {
      const data = await api.get('/stats');
      const s = data.stats;
      const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;

      el.innerHTML = `
        <div class="page-header"><h2>Dashboard</h2></div>
        <div class="stat-grid">
          <div class="stat-card"><div class="label">Total Users</div><div class="value">${s.total}</div></div>
          <div class="stat-card"><div class="label">Completed</div><div class="value">${s.completed} <small>(${pct}%)</small></div></div>
          <div class="stat-card"><div class="label">Last 24h</div><div class="value">${s.last_24h}</div></div>
          <div class="stat-card"><div class="label">Last 7 days</div><div class="value">${s.last_7d}</div></div>
        </div>
        <h3 class="section-title">Roles Breakdown</h3>
        <div class="table-container"><table>
          <thead><tr><th>Role</th><th>Count</th></tr></thead>
          <tbody>${data.roles.map(r => `<tr><td>${esc(r.role || '(none)')}</td><td>${r.cnt}</td></tr>`).join('')}</tbody>
        </table></div>
        <h3 class="section-title">Recent Users</h3>
        <div class="table-container"><table>
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Lang</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>${data.recent.map(u => `<tr>
            <td>${esc(u.display_name || u.first_name || '-')}</td>
            <td>${u.username ? '@' + esc(u.username) : '-'}</td>
            <td>${esc(u.role || '-')}</td>
            <td>${u.lang}</td>
            <td><span class="badge ${u.onboarding_complete ? 'badge-green' : 'badge-yellow'}">${u.onboarding_complete ? 'Complete' : 'Pending'}</span></td>
            <td>${formatDate(u.joined_at)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      `;
    } catch (err) {
      el.innerHTML = `<p class="error">Failed to load: ${esc(err.message)}</p>`;
    }
  }

  // ── Users ──
  let usersPage = 0;
  const USERS_LIMIT = 20;

  async function renderUsers() {
    const el = document.getElementById('page-users');
    el.innerHTML = `
      <div class="page-header"><h2>Users</h2></div>
      <div class="toolbar">
        <input type="text" id="user-search" placeholder="Search by name, username, or ID...">
        <a href="/api/users/export/csv?token=${encodeURIComponent(token)}" class="btn btn-outline" download>Export CSV</a>
      </div>
      <div id="users-table-area"><p class="text-muted">Loading...</p></div>
    `;
    document.getElementById('user-search').addEventListener('input', debounce(async (e) => {
      const q = e.target.value.trim();
      if (q.length < 2) { await loadUsersPage(0); return; }
      try {
        const data = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
        renderUsersTable(data.users, 0, data.users.length, true);
      } catch (err) { toast(err.message, 'error'); }
    }, 300));
    await loadUsersPage(0);
  }

  async function loadUsersPage(page) {
    usersPage = page;
    try {
      const data = await api.get(`/users?page=${page}&limit=${USERS_LIMIT}`);
      renderUsersTable(data.users, page, data.total, false);
    } catch (err) {
      document.getElementById('users-table-area').innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  function renderUsersTable(users, page, total, isSearch) {
    const area = document.getElementById('users-table-area');
    const totalPages = Math.ceil(total / USERS_LIMIT);
    const offset = page * USERS_LIMIT;

    area.innerHTML = `
      <div class="table-container"><table>
        <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Role</th><th>Lang</th><th>Status</th><th>Joined</th><th></th></tr></thead>
        <tbody>${users.map((u, i) => `<tr>
          <td>${offset + i + 1}</td>
          <td>${esc(u.display_name || u.first_name || '-')}</td>
          <td>${u.username ? '@' + esc(u.username) : '-'}</td>
          <td>${esc(u.role || '-')}</td>
          <td>${u.lang}</td>
          <td><span class="badge ${u.onboarding_complete ? 'badge-green' : 'badge-yellow'}">${u.onboarding_complete ? 'Done' : 'Pending'}</span></td>
          <td>${formatDate(u.joined_at)}</td>
          <td><button class="btn btn-sm btn-primary" data-uid="${u.telegram_id}">View</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
      ${!isSearch ? `<div class="pagination">
        <button ${page === 0 ? 'disabled' : ''} data-action="prev">Prev</button>
        <span>Page ${page + 1} of ${totalPages || 1} (${total} users)</span>
        <button ${page >= totalPages - 1 ? 'disabled' : ''} data-action="next">Next</button>
      </div>` : `<p class="text-muted">${total} result${total !== 1 ? 's' : ''}</p>`}
    `;

    area.querySelectorAll('[data-uid]').forEach(btn => {
      btn.addEventListener('click', () => showUserDetail(parseInt(btn.dataset.uid)));
    });
    const prevBtn = area.querySelector('[data-action="prev"]');
    const nextBtn = area.querySelector('[data-action="next"]');
    if (prevBtn) prevBtn.addEventListener('click', () => loadUsersPage(page - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => loadUsersPage(page + 1));
  }

  async function showUserDetail(id) {
    try {
      const data = await api.get(`/users/${id}`);
      const u = data.user;
      showModal(`
        <h3>User Detail</h3>
        <table style="width:100%">
          <tr><td><strong>Telegram ID</strong></td><td>${u.telegram_id}</td></tr>
          <tr><td><strong>Username</strong></td><td>${u.username ? '@' + esc(u.username) : '-'}</td></tr>
          <tr><td><strong>First Name</strong></td><td>${esc(u.first_name || '-')}</td></tr>
          <tr><td><strong>Display Name</strong></td><td>${esc(u.display_name || '-')}</td></tr>
          <tr><td><strong>Role</strong></td><td>${esc(u.role || '-')}</td></tr>
          <tr><td><strong>Experience</strong></td><td>${esc(u.experience || '-')}</td></tr>
          <tr><td><strong>Interests</strong></td><td>${esc(u.interests || '-')}</td></tr>
          <tr><td><strong>Language</strong></td><td>${u.lang}</td></tr>
          <tr><td><strong>Onboarding</strong></td><td>${u.onboarding_complete ? '<span class="badge badge-green">Complete</span>' : `Step ${u.onboarding_step}/4`}</td></tr>
          <tr><td><strong>Joined</strong></td><td>${formatDate(u.joined_at)}</td></tr>
          <tr><td><strong>Subscriptions</strong></td><td>${data.subscriptions.length > 0 ? data.subscriptions.join(', ') : 'None'}</td></tr>
        </table>
        <div style="margin-top:1rem;text-align:right">
          <button class="btn btn-outline" id="modal-close-btn">Close</button>
        </div>
      `);
      document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── Settings ──
  async function renderSettings() {
    const el = document.getElementById('page-settings');
    el.innerHTML = `
      <div class="page-header"><h2>Onboarding Settings</h2></div>
      <div id="settings-roles"></div>
      <div id="settings-experience"></div>
      <div id="settings-interests"></div>
    `;
    await Promise.all([
      renderSettingSection('roles', 'Roles', 'settings-roles'),
      renderSettingSection('experience', 'Experience Levels', 'settings-experience'),
      renderSettingSection('interests', 'Interests', 'settings-interests'),
    ]);
  }

  async function renderSettingSection(key, title, containerId) {
    const container = document.getElementById(containerId);
    try {
      const data = await api.get(`/settings/${key}`);
      const items = data.items;

      container.innerHTML = `
        <h3 class="section-title">${title}</h3>
        <div class="form-card">
          <div id="${key}-items">
            ${items.map(item => `
              <div class="setting-item">
                <span class="item-id">${esc(item.id)}</span>
                <div class="item-labels">
                  <div class="item-label">${esc(item.en)}</div>
                  <div class="item-label-uk">${esc(item.uk || '')}</div>
                </div>
                <button class="btn btn-sm btn-danger" data-remove-key="${key}" data-remove-id="${item.id}">Remove</button>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid #eee">
            <div class="form-row">
              <div class="form-group"><label>ID</label><input type="text" id="${key}-new-id" placeholder="e.g. analyst"></div>
              <div class="form-group"><label>EN</label><input type="text" id="${key}-new-en" placeholder="English label"></div>
              <div class="form-group"><label>UK</label><input type="text" id="${key}-new-uk" placeholder="Ukrainian label"></div>
            </div>
            <button class="btn btn-success" data-add-key="${key}">Add Option</button>
          </div>
        </div>
      `;

      container.querySelectorAll('[data-remove-key]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Remove "${btn.dataset.removeId}" from ${key}?`)) return;
          try {
            await api.del(`/settings/${btn.dataset.removeKey}/options/${btn.dataset.removeId}`);
            toast('Removed');
            renderSettingSection(key, title, containerId);
          } catch (err) { toast(err.message, 'error'); }
        });
      });

      container.querySelector(`[data-add-key="${key}"]`).addEventListener('click', async () => {
        const id = document.getElementById(`${key}-new-id`).value.trim();
        const en = document.getElementById(`${key}-new-en`).value.trim();
        const uk = document.getElementById(`${key}-new-uk`).value.trim();
        if (!id || !en) { toast('ID and EN label are required', 'error'); return; }
        try {
          await api.post(`/settings/${key}/options`, { id, en, uk: uk || en });
          toast('Added');
          renderSettingSection(key, title, containerId);
        } catch (err) { toast(err.message, 'error'); }
      });
    } catch (err) {
      container.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  // ── Subscriptions ──
  async function renderSubscriptions() {
    const el = document.getElementById('page-subscriptions');
    el.innerHTML = '<div class="page-header"><h2>Subscriptions</h2></div><p class="text-muted">Loading...</p>';
    try {
      const data = await api.get('/subscriptions');
      if (data.subscriptions.length === 0) {
        el.innerHTML = `<div class="page-header"><h2>Subscriptions</h2></div><p class="text-muted">No subscriptions yet.</p>`;
        return;
      }
      el.innerHTML = `
        <div class="page-header"><h2>Subscriptions</h2></div>
        <div class="table-container"><table>
          <thead><tr><th>Topic</th><th>Slug</th><th>Subscribers</th></tr></thead>
          <tbody>${data.subscriptions.map(s => `<tr>
            <td>${esc(s.title_en)}</td>
            <td class="text-muted">${esc(s.topic_slug)}</td>
            <td><span class="badge badge-blue">${s.count}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>
      `;
    } catch (err) {
      el.innerHTML = `<div class="page-header"><h2>Subscriptions</h2></div><p class="error">${esc(err.message)}</p>`;
    }
  }

  // ── Broadcast ──
  let topicsCache = null;

  async function renderBroadcast() {
    const el = document.getElementById('page-broadcast');
    el.innerHTML = `
      <div class="page-header"><h2>Broadcast</h2></div>
      <div class="form-card">
        <div class="form-group">
          <label>Audience</label>
          <select id="broadcast-audience">
            <option value="all">All Users</option>
            <option value="completed">Completed Profiles Only</option>
            <option value="topic">Topic Subscribers</option>
          </select>
        </div>
        <div class="form-group hidden" id="broadcast-topic-group">
          <label>Topic</label>
          <select id="broadcast-topic"><option value="">Loading topics...</option></select>
        </div>
        <div class="form-group">
          <label>Message (HTML supported)</label>
          <textarea id="broadcast-text" placeholder="<b>Hello!</b> Your message here..."></textarea>
        </div>
        <button class="btn btn-primary" id="broadcast-send-btn">Send Broadcast</button>
        <div id="broadcast-result" style="margin-top:1rem"></div>
      </div>
    `;

    const audienceSelect = document.getElementById('broadcast-audience');
    const topicGroup = document.getElementById('broadcast-topic-group');

    audienceSelect.addEventListener('change', async () => {
      if (audienceSelect.value === 'topic') {
        topicGroup.classList.remove('hidden');
        if (!topicsCache) {
          try {
            const data = await api.get('/topics');
            topicsCache = data.topics;
          } catch (err) { topicsCache = []; }
        }
        const topicSelect = document.getElementById('broadcast-topic');
        topicSelect.innerHTML = topicsCache.map(t =>
          `<option value="${esc(t.slug)}">${esc(t.levelEmoji)} ${esc(t.title_en)}</option>`
        ).join('');
      } else {
        topicGroup.classList.add('hidden');
      }
    });

    document.getElementById('broadcast-send-btn').addEventListener('click', async () => {
      const audience = audienceSelect.value;
      const topicSlug = audience === 'topic' ? document.getElementById('broadcast-topic').value : undefined;
      const text = document.getElementById('broadcast-text').value.trim();
      if (!text) { toast('Message cannot be empty', 'error'); return; }
      if (audience === 'topic' && !topicSlug) { toast('Select a topic', 'error'); return; }

      const label = audience === 'topic' ? `topic "${topicSlug}" subscribers` : audience === 'completed' ? 'completed users' : 'ALL users';
      if (!confirm(`Send this message to ${label}?`)) return;

      const resultEl = document.getElementById('broadcast-result');
      resultEl.innerHTML = '<p class="text-muted">Sending...</p>';
      try {
        const res = await api.post('/broadcast', { audience, topicSlug, text });
        resultEl.innerHTML = `<p class="badge badge-green">Broadcast started! Sending to ${res.total} user${res.total !== 1 ? 's' : ''}...</p>`;
        toast('Broadcast started');
      } catch (err) {
        resultEl.innerHTML = `<p class="error">${esc(err.message)}</p>`;
      }
    });
  }

  // ── Schedule ──
  async function renderSchedule() {
    const el = document.getElementById('page-schedule');
    el.innerHTML = `
      <div class="page-header"><h2>Scheduled Messages</h2></div>
      <div class="form-card">
        <h3 class="section-title">Create Scheduled Message</h3>
        <div class="form-group">
          <label>Send At (UTC)</label>
          <input type="datetime-local" id="schedule-datetime">
        </div>
        <div class="form-group">
          <label>Audience</label>
          <select id="schedule-audience">
            <option value="all">All Users</option>
            <option value="completed">Completed Profiles Only</option>
            <option value="topic">Topic Subscribers</option>
          </select>
        </div>
        <div class="form-group hidden" id="schedule-topic-group">
          <label>Topic</label>
          <select id="schedule-topic"><option value="">Loading...</option></select>
        </div>
        <div class="form-group">
          <label>Message (HTML supported)</label>
          <textarea id="schedule-text" placeholder="<b>Hello!</b> Your message here..."></textarea>
        </div>
        <button class="btn btn-success" id="schedule-create-btn">Schedule Message</button>
      </div>
      <h3 class="section-title" style="margin-top:2rem">Scheduled Messages</h3>
      <div id="schedule-list"><p class="text-muted">Loading...</p></div>
    `;

    // Audience toggle
    const aud = document.getElementById('schedule-audience');
    const topicGrp = document.getElementById('schedule-topic-group');
    aud.addEventListener('change', async () => {
      if (aud.value === 'topic') {
        topicGrp.classList.remove('hidden');
        if (!topicsCache) {
          try {
            const data = await api.get('/topics');
            topicsCache = data.topics;
          } catch (err) { topicsCache = []; }
        }
        document.getElementById('schedule-topic').innerHTML = topicsCache.map(t =>
          `<option value="${esc(t.slug)}">${esc(t.levelEmoji)} ${esc(t.title_en)}</option>`
        ).join('');
      } else {
        topicGrp.classList.add('hidden');
      }
    });

    // Create handler
    document.getElementById('schedule-create-btn').addEventListener('click', async () => {
      const datetime = document.getElementById('schedule-datetime').value;
      const audience = aud.value;
      const topicSlug = audience === 'topic' ? document.getElementById('schedule-topic').value : undefined;
      const text = document.getElementById('schedule-text').value.trim();

      if (!datetime) { toast('Set a date/time', 'error'); return; }
      if (!text) { toast('Message cannot be empty', 'error'); return; }

      const sendAt = datetime.replace('T', ' ');
      try {
        await api.post('/schedule', { text, audience, topicSlug, sendAt });
        toast('Message scheduled');
        document.getElementById('schedule-text').value = '';
        document.getElementById('schedule-datetime').value = '';
        loadScheduleList();
      } catch (err) { toast(err.message, 'error'); }
    });

    loadScheduleList();
  }

  async function loadScheduleList() {
    const area = document.getElementById('schedule-list');
    try {
      const data = await api.get('/schedule');
      const msgs = data.messages;
      if (msgs.length === 0) {
        area.innerHTML = '<p class="text-muted">No scheduled messages yet.</p>';
        return;
      }

      area.innerHTML = `
        <div class="table-container"><table>
          <thead><tr><th>ID</th><th>Send At</th><th>Audience</th><th>Status</th><th>Sent</th><th>Message</th><th></th></tr></thead>
          <tbody>${msgs.map(m => `<tr>
            <td>${m.id}</td>
            <td>${esc(m.send_at)}</td>
            <td>${esc(m.audience)}${m.topic_slug ? ' (' + esc(m.topic_slug) + ')' : ''}</td>
            <td><span class="badge ${m.status === 'sent' ? 'badge-green' : m.status === 'pending' ? 'badge-yellow' : m.status === 'cancelled' ? 'badge-red' : 'badge-blue'}">${m.status}</span></td>
            <td>${m.sent_count || 0}</td>
            <td title="${esc(m.text)}">${esc((m.text || '').substring(0, 60))}${(m.text || '').length > 60 ? '...' : ''}</td>
            <td>${m.status === 'pending' ? `<button class="btn btn-sm btn-danger" data-cancel-id="${m.id}">Cancel</button>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      `;

      area.querySelectorAll('[data-cancel-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Cancel this scheduled message?')) return;
          try {
            await api.del(`/schedule/${btn.dataset.cancelId}`);
            toast('Cancelled');
            loadScheduleList();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      area.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  // ── Leaderboard ──
  async function renderLeaderboard() {
    const el = document.getElementById('page-leaderboard');
    el.innerHTML = '<div class="page-header"><h2>Leaderboard</h2></div><p class="text-muted">Loading...</p>';
    try {
      const data = await api.get('/leaderboard');
      const lb = data.leaderboard;
      const levels = data.levels;

      if (lb.length === 0) {
        el.innerHTML = `<div class="page-header"><h2>Leaderboard</h2></div><p class="text-muted">No XP data yet.</p>`;
        return;
      }

      // Level distribution
      const levelCounts = {};
      levels.forEach(l => { levelCounts[l.level] = 0; });
      lb.forEach(u => { if (levelCounts[u.xp_level] !== undefined) levelCounts[u.xp_level]++; });

      const maxCount = Math.max(...Object.values(levelCounts), 1);

      el.innerHTML = `
        <div class="page-header"><h2>Leaderboard</h2></div>
        <h3 class="section-title">Level Distribution</h3>
        <div class="form-card">
          ${levels.map(l => {
            const count = levelCounts[l.level] || 0;
            const pct = Math.round((count / maxCount) * 100);
            return `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem">
              <span style="min-width:120px;font-size:0.85rem">${esc(l.title_en)}</span>
              <div style="flex:1;background:#eee;border-radius:4px;height:20px">
                <div style="width:${pct}%;background:#4f46e5;border-radius:4px;height:100%;min-width:${count > 0 ? '2px' : '0'}"></div>
              </div>
              <span style="min-width:30px;text-align:right;font-size:0.85rem">${count}</span>
            </div>`;
          }).join('')}
        </div>
        <h3 class="section-title">XP Rankings</h3>
        <div class="table-container"><table>
          <thead><tr><th>#</th><th>Name</th><th>Level</th><th>Title</th><th>XP</th></tr></thead>
          <tbody>${lb.map((u, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
            const levelInfo = levels.find(l => l.level === u.xp_level) || levels[0];
            return `<tr>
              <td>${medal || (i + 1)}</td>
              <td>${esc(u.display_name || u.first_name || u.username || '-')}</td>
              <td><span class="badge badge-blue">${u.xp_level}</span></td>
              <td>${esc(levelInfo.title_en)}</td>
              <td><strong>${u.xp}</strong></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      `;
    } catch (err) {
      el.innerHTML = `<div class="page-header"><h2>Leaderboard</h2></div><p class="error">${esc(err.message)}</p>`;
    }
  }

  // ── Homework ──
  async function renderHomework() {
    const el = document.getElementById('page-homework');
    el.innerHTML = `
      <div class="page-header"><h2>Homework</h2></div>
      <div class="form-card">
        <h3 class="section-title">Create Homework</h3>
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="hw-title" placeholder="e.g. Week 1 Assignment">
        </div>
        <div class="form-group">
          <label>Topics (select multiple)</label>
          <select id="hw-topics" multiple style="height:150px"><option>Loading...</option></select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Deadline (UTC)</label>
            <input type="datetime-local" id="hw-deadline">
          </div>
          <div class="form-group">
            <label>XP per topic</label>
            <input type="number" id="hw-xp" value="30" min="1" max="500">
          </div>
        </div>
        <button class="btn btn-success" id="hw-create-btn">Create Homework</button>
      </div>
      <h3 class="section-title" style="margin-top:2rem">All Homework</h3>
      <div id="hw-list"><p class="text-muted">Loading...</p></div>
    `;

    // Load topics for selector
    if (!topicsCache) {
      try {
        const data = await api.get('/topics');
        topicsCache = data.topics;
      } catch (err) { topicsCache = []; }
    }
    const topicSelect = document.getElementById('hw-topics');
    topicSelect.innerHTML = topicsCache.map(t =>
      `<option value="${esc(t.slug)}">${esc(t.levelEmoji)} ${esc(t.title_en)}</option>`
    ).join('');

    // Create handler
    document.getElementById('hw-create-btn').addEventListener('click', async () => {
      const title = document.getElementById('hw-title').value.trim();
      const selected = Array.from(document.getElementById('hw-topics').selectedOptions).map(o => o.value);
      const deadline = document.getElementById('hw-deadline').value.replace('T', ' ');
      const xpReward = parseInt(document.getElementById('hw-xp').value) || 30;

      if (!title) { toast('Title is required', 'error'); return; }
      if (selected.length === 0) { toast('Select at least one topic', 'error'); return; }

      try {
        await api.post('/homework', { title, topicSlugs: selected, deadline: deadline || null, xpReward });
        toast('Homework created');
        document.getElementById('hw-title').value = '';
        loadHomeworkList();
      } catch (err) { toast(err.message, 'error'); }
    });

    loadHomeworkList();
  }

  async function loadHomeworkList() {
    const area = document.getElementById('hw-list');
    try {
      const data = await api.get('/homework');
      const items = data.homework;
      if (items.length === 0) {
        area.innerHTML = '<p class="text-muted">No homework yet.</p>';
        return;
      }

      area.innerHTML = `
        <div class="table-container"><table>
          <thead><tr><th>ID</th><th>Title</th><th>Topics</th><th>Deadline</th><th>XP</th><th>Status</th><th>Completed</th><th></th></tr></thead>
          <tbody>${items.map(hw => {
            const slugs = (hw.topic_slugs || '').split(',').filter(Boolean);
            return `<tr>
              <td>${hw.id}</td>
              <td>${esc(hw.title)}</td>
              <td>${slugs.length} topic${slugs.length !== 1 ? 's' : ''}</td>
              <td>${hw.deadline ? esc(hw.deadline) : '-'}</td>
              <td>${hw.xp_reward}</td>
              <td><span class="badge ${hw.status === 'active' ? 'badge-green' : 'badge-yellow'}">${hw.status}</span></td>
              <td>${hw.completedCount || 0} users</td>
              <td>
                <button class="btn btn-sm btn-primary" data-hw-detail="${hw.id}">Detail</button>
                ${hw.status === 'active' ? `<button class="btn btn-sm btn-danger" data-hw-close="${hw.id}">Close</button>` : ''}
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      `;

      area.querySelectorAll('[data-hw-detail]').forEach(btn => {
        btn.addEventListener('click', () => showHomeworkDetail(parseInt(btn.dataset.hwDetail)));
      });

      area.querySelectorAll('[data-hw-close]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Close this homework?')) return;
          try {
            await api.put(`/homework/${btn.dataset.hwClose}/close`);
            toast('Homework closed');
            loadHomeworkList();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      area.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  async function showHomeworkDetail(id) {
    try {
      const data = await api.get(`/homework/${id}`);
      const hw = data.homework;
      const progress = data.progress;
      const slugs = (hw.topic_slugs || '').split(',').filter(Boolean);

      showModal(`
        <h3>${esc(hw.title)}</h3>
        <p><strong>Topics:</strong> ${slugs.join(', ')}</p>
        <p><strong>Deadline:</strong> ${hw.deadline || 'None'}</p>
        <p><strong>XP reward:</strong> ${hw.xp_reward} per topic</p>
        <p><strong>Status:</strong> ${hw.status}</p>
        <p><strong>Completed by:</strong> ${data.completedCount} users</p>
        <h4 style="margin-top:1rem">Progress</h4>
        ${progress.length === 0 ? '<p class="text-muted">No completions yet.</p>' : `
        <div class="table-container"><table>
          <thead><tr><th>User</th><th>Topic</th><th>Done</th><th>Completed At</th></tr></thead>
          <tbody>${progress.map(p => `<tr>
            <td>${esc(p.display_name || p.first_name || p.username || '-')}</td>
            <td>${esc(p.topic_slug)}</td>
            <td>${p.completed ? '✅' : '⬜'}</td>
            <td>${p.completed_at || '-'}</td>
          </tr>`).join('')}</tbody>
        </table></div>`}
        <div style="margin-top:1rem;text-align:right">
          <button class="btn btn-outline" id="modal-close-btn">Close</button>
        </div>
      `);
      document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    } catch (err) { toast(err.message, 'error'); }
  }

  // ── Contests ──
  async function renderContests() {
    const el = document.getElementById('page-contests');
    el.innerHTML = '<p class="text-muted">Loading...</p>';

    try {
      const data = await api.get('/contests');
      const contests = data.contests || [];

      const statusBadge = (s) => {
        const colors = { pending: '#6c757d', active: '#28a745', voting: '#fd7e14', closed: '#dc3545' };
        return `<span style="background:${colors[s]||'#888'};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.8em">${s}</span>`;
      };
      const typeBadge = (t) => {
        const colors = { poll: '#007bff', quiz: '#6f42c1', challenge: '#17a2b8' };
        return `<span style="background:${colors[t]||'#888'};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.8em">${t}</span>`;
      };

      let html = `
        <h2>Contests</h2>
        <div style="margin-bottom:1.5rem;padding:1rem;background:#f8f9fa;border-radius:8px">
          <h3 style="margin-top:0">Create Contest</h3>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem">
            <select id="contest-type" style="padding:0.4rem">
              <option value="poll">Poll</option>
              <option value="quiz">Quiz</option>
              <option value="challenge">Challenge</option>
            </select>
            <input id="contest-title" placeholder="Title" style="flex:1;min-width:200px;padding:0.4rem">
            <input id="contest-deadline" type="datetime-local" style="padding:0.4rem">
          </div>
          <textarea id="contest-desc" placeholder="Description (optional)" rows="2" style="width:100%;margin-bottom:0.5rem;padding:0.4rem"></textarea>
          <button id="create-contest-btn" class="btn btn-primary">Create Contest</button>
        </div>

        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>Type</th><th>Title</th><th>Status</th><th>Deadline</th><th>Entries</th><th>Actions</th></tr>
          </thead>
          <tbody>
      `;

      if (contests.length === 0) {
        html += '<tr><td colspan="7" style="text-align:center">No contests yet</td></tr>';
      } else {
        for (const c of contests) {
          const dl = c.deadline ? new Date(c.deadline).toLocaleString() : '—';
          html += `<tr>
            <td>${c.id}</td>
            <td>${typeBadge(c.type)}</td>
            <td><a href="#" class="contest-detail-link" data-id="${c.id}">${c.title}</a></td>
            <td>${statusBadge(c.status)}</td>
            <td>${dl}</td>
            <td>—</td>
            <td>
              ${c.status !== 'closed' ? `<button class="btn btn-sm btn-danger close-contest-btn" data-id="${c.id}">Close</button>` : ''}
              ${c.status === 'pending' ? `<button class="btn btn-sm btn-success activate-contest-btn" data-id="${c.id}">Activate</button>` : ''}
              ${c.status === 'active' && c.type === 'challenge' ? `<button class="btn btn-sm btn-warning voting-contest-btn" data-id="${c.id}">→ Voting</button>` : ''}
            </td>
          </tr>`;
        }
      }

      html += '</tbody></table>';
      el.innerHTML = html;

      // Create contest
      document.getElementById('create-contest-btn').addEventListener('click', async () => {
        const type = document.getElementById('contest-type').value;
        const title = document.getElementById('contest-title').value.trim();
        const description = document.getElementById('contest-desc').value.trim();
        const deadline = document.getElementById('contest-deadline').value || null;

        if (!title) return alert('Title is required');
        try {
          await api.post('/contests', { type, title, description, deadline: deadline ? deadline.replace('T', ' ') : null });
          renderContests();
        } catch (err) { alert('Error: ' + err.message); }
      });

      // Close contest buttons
      el.querySelectorAll('.close-contest-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Close this contest?')) return;
          try {
            await api.put(`/contests/${btn.dataset.id}/close`);
            renderContests();
          } catch (err) { alert('Error: ' + err.message); }
        });
      });

      // Activate contest buttons
      el.querySelectorAll('.activate-contest-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api.put(`/contests/${btn.dataset.id}/status`, { status: 'active' });
            renderContests();
          } catch (err) { alert('Error: ' + err.message); }
        });
      });

      // Voting transition buttons
      el.querySelectorAll('.voting-contest-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api.put(`/contests/${btn.dataset.id}/status`, { status: 'voting' });
            renderContests();
          } catch (err) { alert('Error: ' + err.message); }
        });
      });

      // Contest detail links
      el.querySelectorAll('.contest-detail-link').forEach(link => {
        link.addEventListener('click', async (e) => {
          e.preventDefault();
          await showContestDetail(parseInt(link.dataset.id));
        });
      });

    } catch (err) {
      el.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
  }

  async function showContestDetail(id) {
    try {
      const data = await api.get(`/contests/${id}`);
      const c = data.contest;
      const results = data.results || [];

      const statusBadge = (s) => {
        const colors = { pending: '#6c757d', active: '#28a745', voting: '#fd7e14', closed: '#dc3545' };
        return `<span style="background:${colors[s]||'#888'};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.8em">${s}</span>`;
      };

      let html = `
        <h3>${c.title} ${statusBadge(c.status)}</h3>
        <p><strong>Type:</strong> ${c.type} | <strong>Created:</strong> ${new Date(c.created_at).toLocaleString()}</p>
        ${c.description ? `<p>${c.description}</p>` : ''}
        ${c.deadline ? `<p><strong>Deadline:</strong> ${new Date(c.deadline).toLocaleString()}</p>` : ''}
        <p><strong>XP:</strong> 1st: ${c.xp_first} | 2nd: ${c.xp_second} | 3rd: ${c.xp_third} | Participation: ${c.xp_participate}</p>
        <h4>Entries / Results (${results.length})</h4>
      `;

      if (results.length === 0) {
        html += '<p class="text-muted">No entries yet</p>';
      } else {
        html += '<table class="data-table"><thead><tr><th>#</th><th>User</th>';
        if (c.type === 'quiz') html += '<th>Score</th><th>Correct</th>';
        if (c.type === 'challenge') html += '<th>Answer</th><th>Votes</th>';
        if (c.type === 'poll') html += '<th>Answer</th>';
        html += '</tr></thead><tbody>';

        results.forEach((r, i) => {
          const name = r.display_name || r.first_name || r.username || r.user_id;
          html += `<tr><td>${i + 1}</td><td>${name}</td>`;
          if (c.type === 'quiz') html += `<td>${r.score}</td><td>${r.is_correct ? 'Yes' : 'No'}</td>`;
          if (c.type === 'challenge') html += `<td>${(r.answer || '').substring(0, 100)}</td><td>${r.votes || 0}</td>`;
          if (c.type === 'poll') html += `<td>${r.answer || '—'}</td>`;
          html += '</tr>';
        });

        html += '</tbody></table>';
      }

      html += '<br><button class="btn btn-secondary" id="back-to-contests">← Back to Contests</button>';

      showModal(html);

      document.getElementById('back-to-contests').addEventListener('click', () => {
        closeModal();
      });

    } catch (err) {
      alert('Error loading contest: ' + err.message);
    }
  }

  // ── Init ──
  function init() {
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => { e.preventDefault(); navigate(link.dataset.page); });
    });

    window.addEventListener('hashchange', () => {
      const page = location.hash.slice(1) || 'dashboard';
      if (page !== currentPage) navigate(page);
    });

    checkAuth();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
