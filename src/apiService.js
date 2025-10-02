const API_BASE_URL = process.env.REACT_APP_API_URL;

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async validateAdminCredentials(email, password) {
    return this.request('/auth', {
      method: 'POST',
      body: { email, password }
    });
  }

  // Users
  async listUsers(searchTerm = '') {
    const query = searchTerm ? `?searchTerm=${encodeURIComponent(searchTerm)}` : '';
    return this.request(`/users${query}`);
  }

  async createUser(email, name, company, tempPassword) {
    return this.request('/users/create', {
      method: 'POST',
      body: { email, name, company, tempPassword }
    });
  }

  async recreateUser(username, tempPassword) {
    return this.request('/users/recreate', {
      method: 'POST',
      body: { username, tempPassword }
    });
  }

  async deleteUser(username) {
    return this.request('/users/delete', {
      method: 'POST',
      body: { username }
    });
  }

  async resetUserPassword(username, newPassword) {
    return this.request('/users/reset-password', {
      method: 'POST',
      body: { username, newPassword }
    });
  }

  async setPermanentPassword(username, newPassword) {
    return this.request('/users/set-password', {
      method: 'POST',
      body: { username, newPassword }
    });
  }

  async enableUser(username) {
    return this.request('/users/enable', {
      method: 'POST',
      body: { username }
    });
  }

  async disableUser(username) {
    return this.request('/users/disable', {
      method: 'POST',
      body: { username }
    });
  }

  // MFA
  async enableMFA(username) {
    return this.request('/users/mfa/enable', {
      method: 'POST',
      body: { username }
    });
  }

  async disableMFA(username) {
    return this.request('/users/mfa/disable', {
      method: 'POST',
      body: { username }
    });
  }

  async getMFAStatus(username, userPoolMFAConfig) {
    return this.request('/users/mfa/status', {
      method: 'POST',
      body: { username, userPoolMFAConfig }
    });
  }

  // Pool configuration
  async getUserPoolMFAConfig() {
    return this.request('/pool/mfa');
  }

  async setUserPoolMFAConfig(mfaConfiguration) {
    return this.request('/pool/mfa', {
      method: 'POST',
      body: { mfaConfiguration }
    });
  }
}

export default new ApiService();