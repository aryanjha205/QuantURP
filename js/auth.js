/* ============================================================
   Auth Module — handles login, logout, token management
   Backend: https://quanturpp.vercel.app
   ============================================================ */

// The frontend deployment proxies /api to the backend. Keeping requests on
// this origin prevents browser CORS failures during signup and login.
const API_V1 = '/api/v1';

const Auth = {
  /**
   * Login with email + password via OAuth2 form-data endpoint
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{access_token: string, token_type: string}>}
   */
  async login(email, password) {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await fetch(`${API_V1}/login/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Invalid email or password');
    }

    const data = await res.json();
    localStorage.setItem('erp_token', data.access_token);
    return data;
  },

  /**
   * Test / validate the current token and get user info
   * @returns {Promise<object>} user object
   */
  async getUser() {
    const token = this.getToken();
    if (!token) throw new Error('No token');

    const res = await fetch(`${API_V1}/login/test-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      this.logout();
      throw new Error('Session expired');
    }

    return res.json();
  },

  /**
   * Get stored JWT token
   */
  getToken() {
    return localStorage.getItem('erp_token');
  },

  /**
   * Auth header for API requests
   */
  authHeaders() {
    return {
      'Authorization': `Bearer ${this.getToken()}`,
      'Content-Type': 'application/json',
    };
  },

  /**
   * Logout — clear token, redirect to login
   */
  logout() {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    window.location.href = 'index.html';
  },

  /**
   * Guard — call on protected pages to ensure auth
   */
  guard() {
    if (!this.getToken()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  /**
   * Generic API request wrapper
   */
  async apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_V1}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.authHeaders(),
        ...(options.headers || {}),
      },
    });

    if (res.status === 401 || res.status === 403) {
      this.logout();
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'API error');
    }

    return res.json();
  },
};
