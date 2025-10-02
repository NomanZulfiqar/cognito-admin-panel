import React from 'react';
import './LandingPage.css';

function LandingPage({ onNavigateToAdmin, onNavigateToCreateUser, onLogout }) {
  const userPoolId = process.env.REACT_APP_USER_POOL_ID || 'Not configured';
  
  return (
    <div className="landing-page">
      <h1>Cognito Admin Portal</h1>
      <p>User Pool: {userPoolId}</p>
      
      <div className="admin-options">
        <button 
          className="admin-link-btn"
          onClick={onNavigateToCreateUser}
        >
          Create User
        </button>
        
        <button 
          className="admin-link-btn"
          onClick={onNavigateToAdmin}
        >
          User Management (MFA & Password Reset)
        </button>
      </div>
    </div>
  );
}

export default LandingPage;