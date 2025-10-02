import React, { useState } from 'react';
import LandingPage from './LandingPage';
import AdminPage from './AdminPage';
import CreateUserPage from './CreateUserPage';

// Temporary bypass version - rename to App.js to use
function App() {
  const [currentPage, setCurrentPage] = useState('landing');

  const navigateToAdmin = () => setCurrentPage('admin');
  const navigateToCreateUser = () => setCurrentPage('create-user');
  const navigateToLanding = () => setCurrentPage('landing');

  return (
    <div className="app">
      <div style={{background: '#ff9999', padding: '10px', textAlign: 'center'}}>
        ⚠️ AUTH BYPASSED - FOR INITIAL SETUP ONLY ⚠️
      </div>
      {currentPage === 'landing' ? (
        <LandingPage onNavigateToAdmin={navigateToAdmin} onNavigateToCreateUser={navigateToCreateUser} />
      ) : currentPage === 'admin' ? (
        <AdminPage onBackToLanding={navigateToLanding} />
      ) : (
        <CreateUserPage onBackToLanding={navigateToLanding} />
      )}
    </div>
  );
}

export default App;