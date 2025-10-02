import React, { useState } from 'react';
import apiService from './apiService';
import './AuthPage.css';

// Use API service for VPC deployment or direct SDK for localhost
const useApiService = process.env.REACT_APP_API_URL ? apiService : {
  async validateAdminCredentials(email, password) {
    const { validateAdminCredentials } = await import('./cognitoService');
    return await validateAdminCredentials(email, password);
  }
};

function AuthPage({ onAuthSuccess }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await useApiService.validateAdminCredentials(credentials.username, credentials.password);
      
      if (result.success) {
        localStorage.setItem('adminAuth', JSON.stringify({
          username: credentials.username,
          adminName: result.admin.name,
          timestamp: Date.now()
        }));
        onAuthSuccess();
      } else {
        setError(result.message || 'Invalid credentials. Please check your email and password.');
      }
    } catch (error) {
      setError(`Authentication failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>Admin Portal Login</h1>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              placeholder="Admin email here!!!"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              placeholder="Password!!!"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthPage;