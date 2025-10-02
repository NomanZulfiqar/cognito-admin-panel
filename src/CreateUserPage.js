import React, { useState } from 'react';
import apiService from './apiService';
import './CreateUserPage.css';

// Use API service for VPC deployment or direct SDK for localhost
const useApiService = process.env.REACT_APP_API_URL ? apiService : {
  async createUser(email, name, company, tempPassword) {
    const { createUserSimple, updateUserPoolMFAConfig } = await import('./cognitoService');
    const result = await createUserSimple(email, name, company, tempPassword);
    await updateUserPoolMFAConfig('ON'); // Set to REQUIRED after creation
    return result;
  },
  async setPermanentPassword(username, newPassword) {
    const { setPermanentPassword } = await import('./cognitoService');
    return await setPermanentPassword(username, newPassword);
  }
};

function CreateUserPage({ onBackToLanding }) {
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState({
    email: '',
    tempPassword: '',
    username: '',
    company: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputModalData, setInputModalData] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [createdUser, setCreatedUser] = useState(null);

  const handleStep1Submit = (e) => {
    e.preventDefault();
    if (!userData.email || !userData.tempPassword) {
      setMessage('Please fill in all fields');
      return;
    }
    setMessage('');
    setStep(2);
  };

  const handleStep2Submit = (e) => {
    e.preventDefault();
    if (!userData.company || !userData.name) {
      setMessage('Please fill in all fields');
      return;
    }
    setMessage('');
    setStep(3);
  };

  const handleCreateUser = async () => {
    setLoading(true);
    try {
      setMessage('Creating user...');
      const result = await useApiService.createUser(
        userData.email,
        userData.name,
        userData.company,
        userData.tempPassword
      );
      
      setCreatedUser({
        email: userData.email,
        name: userData.name,
        company: userData.company,
        tempPassword: result.tempPassword,
        username: result.user.Username
      });
      setMessage('User created successfully!');
      setStep(4);
    } catch (error) {
      setMessage(`Error creating user: ${error.message}`);
    }
    setLoading(false);
  };



  const resetForm = () => {
    setStep(1);
    setUserData({ email: '', tempPassword: '', username: '', company: '', name: '' });
    setCreatedUser(null);
    setMessage('');
  };

  return (
    <div className="create-user-page">
      <div className="header">
        <h1>Create New User</h1>
      </div>

      <div className="progress-bar">
        <div className={`step ${step >= 1 ? 'active' : ''}`}>1. User Details</div>
        <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Additional Info</div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Review</div>
        <div className={`step ${step >= 4 ? 'active' : ''}`}>4. Success</div>
      </div>

      {message && <div className="message">{message}</div>}

      {step === 1 && (
        <div className="step-content">
          <h2>Step 1: User Details</h2>
          <form onSubmit={handleStep1Submit}>
            <div className="form-group">
              <label>Email Address:</label>
              <input
                type="email"
                value={userData.email}
                onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Temporary Password:</label>
              <input
                type="password"
                value={userData.tempPassword}
                onChange={(e) => setUserData(prev => ({ ...prev, tempPassword: e.target.value }))}
                placeholder="Min 8 chars, uppercase, lowercase, number"
                required
              />
            </div>
            <button type="submit" className="next-btn">
              Next
            </button>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className="step-content">
          <h2>Step 2: Additional Information</h2>
          <form onSubmit={handleStep2Submit}>
            <div className="form-group">
              <label>Company:</label>
              <input
                type="text"
                value={userData.company}
                onChange={(e) => setUserData(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Enter company name"
                required
              />
            </div>
            <div className="form-group">
              <label>Full Name:</label>
              <input
                type="text"
                value={userData.name}
                onChange={(e) => setUserData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="step-buttons">
              <button type="button" onClick={() => setStep(1)} className="back-btn">
                Back
              </button>
              <button type="submit" className="next-btn">
                Next
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 3 && (
        <div className="step-content">
          <h2>Step 3: Review User Information</h2>
          <div className="review-info">
            <h3>Please review the user details:</h3>
            <div className="review-details">
              <p><strong>Email (Username):</strong> {userData.email}</p>
              <p><strong>Temporary Password:</strong> {userData.tempPassword}</p>
              <p><strong>Company:</strong> {userData.company}</p>
              <p><strong>Full Name:</strong> {userData.name}</p>
            </div>
          </div>
          <div className="step-buttons">
            <button type="button" onClick={() => setStep(2)} className="back-btn">
              Back
            </button>
            <button 
              onClick={handleCreateUser} 
              disabled={loading}
              className="create-btn"
            >
              {loading ? 'Creating User...' : 'Create User'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && createdUser && (
        <div className="step-content">
          <div className="success-header">
            <div className="success-icon">✓</div>
            <h2>User Created Successfully</h2>
            <p className="success-subtitle">The user account has been created and configured</p>
          </div>
          
          <div className="success-details">
            <div className="status-indicators">
              <div className="status-item">
                <span className="status-icon">✓</span>
                <span>User account created</span>
              </div>
              <div className="status-item">
                <span className="status-icon">✓</span>
                <span>MFA configuration set to REQUIRED</span>
              </div>
              <div className="status-item">
                <span className="status-icon">✓</span>
                <span>User will configure MFA on first login</span>
              </div>
            </div>
            
            <div className="user-details-card">
              <div className="card-header">
                <h3>User Information</h3>
                <button 
                  onClick={() => navigator.clipboard.writeText(`Email: ${createdUser.email}\nName: ${createdUser.name}\nCompany: ${createdUser.company}\nTemporary Password: ${createdUser.tempPassword}\nStatus: Must change password on first login`)}
                  className="copy-info-btn"
                  title="Copy user information"
                >
                  📋 Copy
                </button>
              </div>
              <div className="user-details-grid">
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{createdUser.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{createdUser.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Company</span>
                  <span className="detail-value">{createdUser.company}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Temporary Password</span>
                  <span className="detail-value password-value">{createdUser.tempPassword}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <span className="detail-value status-pending">Password change required</span>
                </div>
              </div>
            </div>
            
            <div className="action-section">
              <button 
                onClick={() => {
                  setInputModalData({
                    title: 'Set Permanent Password',
                    message: `Set permanent password for ${createdUser.email}:`,
                    placeholder: 'Min 8 chars, uppercase, lowercase, number',
                    onConfirm: async (password) => {
                      if (!password) return;
                      try {
                        await useApiService.setPermanentPassword(createdUser.email, password);
                        setMessage(`Permanent password set for ${createdUser.email}.`);
                      } catch (error) {
                        setMessage(`Error setting permanent password: ${error.message}`);
                      }
                      setShowInputModal(false);
                      setInputValue('');
                    },
                    onCancel: () => {
                      setShowInputModal(false);
                      setInputValue('');
                    }
                  });
                  setShowInputModal(true);
                }}
                className="action-btn secondary"
              >
                Set Permanent Password
              </button>
            </div>
          </div>
          
          <div className="navigation-section">
            <button onClick={resetForm} className="nav-btn secondary">
              Create Another User
            </button>
            <button onClick={() => window.location.href = '/'} className="nav-btn primary">
              Back to Portal
            </button>
          </div>
        </div>
      )}

      {showInputModal && inputModalData && (
        <div className="confirm-modal">
          <div className="confirm-modal-content">
            <h3>{inputModalData.title}</h3>
            <p>{inputModalData.message}</p>
            <input
              type="password"
              placeholder={inputModalData.placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="modal-input"
              autoFocus
            />
            <div className="confirm-modal-buttons">
              <button onClick={inputModalData.onCancel} className="cancel-btn">
                Cancel
              </button>
              <button 
                onClick={() => inputModalData.onConfirm(inputValue)} 
                className="confirm-btn"
                disabled={!inputValue}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateUserPage;