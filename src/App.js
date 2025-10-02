import React, { useState, useEffect } from 'react';
import AuthPage from './AuthPage';
import LandingPage from './LandingPage';
import AdminPage from './AdminPage';
import CreateUserPage from './CreateUserPage';

import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('landing');

  useEffect(() => {
    const auth = localStorage.getItem('adminAuth');
    if (auth) {
      const { timestamp } = JSON.parse(auth);
      if (Date.now() - timestamp < 8 * 60 * 60 * 1000) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('adminAuth');
      }
    }
  }, []);

  const handleAuthSuccess = () => setIsAuthenticated(true);
  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    setCurrentPage('landing');
  };

  const navigateToAdmin = () => setCurrentPage('admin');
  const navigateToCreateUser = () => setCurrentPage('create-user');
  const navigateToLanding = () => setCurrentPage('landing');

  // Authentication temporarily disabled
  // if (!isAuthenticated) {
  //   return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  // }

  return (
    <div className="app">
      <div className="sidebar">
        {currentPage !== 'landing' && (
          <>
            <button onClick={navigateToCreateUser} className="sidebar-btn nav-btn">Create User</button>
            <button onClick={navigateToAdmin} className="sidebar-btn nav-btn">User Management</button>
          </>
        )}
        {currentPage !== 'landing' && (
          <button onClick={navigateToLanding} className="sidebar-btn back-btn">← Back to Portal</button>
        )}
        <button onClick={handleLogout} className="sidebar-btn logout">Logout</button>
      </div>
      <div className="main-content">
        {currentPage === 'landing' ? (
          <LandingPage onNavigateToAdmin={navigateToAdmin} onNavigateToCreateUser={navigateToCreateUser} onLogout={handleLogout} />
        ) : currentPage === 'admin' ? (
          <AdminPage onBackToLanding={navigateToLanding} />
        ) : (
          <CreateUserPage onBackToLanding={navigateToLanding} />
        )}
      </div>
    </div>
  );
}

export default App;