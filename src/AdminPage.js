import React, { useState, useEffect } from 'react';
import apiService from './apiService';
import { getUserMFAStatus } from './cognitoService';

// Use API service for VPC deployment or direct SDK for localhost
const useApiService = process.env.REACT_APP_API_URL ? apiService : {
  async listUsers(searchTerm) {
    const { listUsers } = await import('./cognitoService');
    return await listUsers(searchTerm);
  },
  async deleteUser(username) {
    const { deleteUser } = await import('./cognitoService');
    return await deleteUser(username);
  },
  async resetPassword(username, newPassword) {
    const { forcePasswordReset } = await import('./cognitoService');
    return await forcePasswordReset(username, newPassword);
  },
  async setPermanentPassword(username, newPassword) {
    const { setPermanentPassword } = await import('./cognitoService');
    return await setPermanentPassword(username, newPassword);
  },
  async recreateUser(username, tempPassword) {
    const { recreateUser } = await import('./cognitoService');
    return await recreateUser(username, tempPassword);
  },
  async enableUser(username) {
    const { enableUser } = await import('./cognitoService');
    return await enableUser(username);
  },
  async disableUser(username) {
    const { disableUser } = await import('./cognitoService');
    return await disableUser(username);
  },
  async enableMFA(username) {
    const { enableTOTPMFA } = await import('./cognitoService');
    return await enableTOTPMFA(username);
  },
  async disableMFA(username) {
    const { disableTOTPMFA } = await import('./cognitoService');
    return await disableTOTPMFA(username);
  },
  async getUserPoolMFAConfig() {
    const { getUserPoolMFAConfig } = await import('./cognitoService');
    return await getUserPoolMFAConfig();
  },
  async setUserPoolMFAConfig(config) {
    const { updateUserPoolMFAConfig } = await import('./cognitoService');
    return await updateUserPoolMFAConfig(config);
  }
};
import './AdminPage.css';

function AdminPage({ onBackToLanding }) {
  const [users, setUsers] = useState([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [mfaFilter, setMfaFilter] = useState('all');
  const [accountStatusFilter, setAccountStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('email');
  const [sortOrder, setSortOrder] = useState('asc');
  const [allUsers, setAllUsers] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [userPoolMFAConfig, setUserPoolMFAConfig] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputModalData, setInputModalData] = useState(null);
  const [inputValue, setInputValue] = useState('');

  const loadUsers = async (mfaConfig = null) => {
    setLoading(true);
    try {
      const userList = await useApiService.listUsers();
      const currentMfaConfig = mfaConfig || userPoolMFAConfig;
      
      // Get MFA status for each user
      const usersWithMFA = await Promise.all(
        userList.map(async (user) => {
          try {
            if (currentMfaConfig && currentMfaConfig.mfaConfiguration === 'OPTIONAL') {
              const mfaStatus = await getUserMFAStatus(user.Username, currentMfaConfig);
              return { ...user, mfaStatus };
            }
            return { ...user, mfaStatus: { mfaActive: false } };
          } catch (error) {
            return { ...user, mfaStatus: { mfaActive: false } };
          }
        })
      );
      
      setAllUsers(usersWithMFA);
      applyFiltersAndSort(usersWithMFA);
      setMessage('');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const applyFiltersAndSort = (userList = allUsers) => {
    let filteredUsers = [...userList];
    let filtersCount = 0;
    
    // Apply search filter
    if (searchUsername.trim()) {
      const searchTerm = searchUsername.toLowerCase();
      filteredUsers = filteredUsers.filter(user => {
        const email = user.Attributes?.find(attr => attr.Name === 'email')?.Value || user.Username;
        const name = user.Attributes?.find(attr => attr.Name === 'name')?.Value || '';
        const company = user.Attributes?.find(attr => attr.Name === 'custom:company')?.Value || '';
        return email.toLowerCase().includes(searchTerm) || 
               name.toLowerCase().includes(searchTerm) ||
               company.toLowerCase().includes(searchTerm);
      });
      filtersCount++;
    }
    
    // Apply MFA filter
    if (mfaFilter !== 'all') {
      filteredUsers = filteredUsers.filter(user => {
        if (mfaFilter === 'active') {
          return user.mfaStatus?.mfaActive === true;
        } else if (mfaFilter === 'inactive') {
          return user.mfaStatus?.mfaActive === false;
        }
        return true;
      });
      filtersCount++;
    }
    
    // Apply Account Status filter
    if (accountStatusFilter !== 'all') {
      filteredUsers = filteredUsers.filter(user => {
        if (accountStatusFilter === 'enabled') {
          return user.Enabled === true;
        } else if (accountStatusFilter === 'disabled') {
          return user.Enabled === false;
        }
        return true;
      });
      filtersCount++;
    }
    

    
    // Apply sorting
    filteredUsers.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'email') {
        aValue = (a.Attributes?.find(attr => attr.Name === 'email')?.Value || a.Username).toLowerCase();
        bValue = (b.Attributes?.find(attr => attr.Name === 'email')?.Value || b.Username).toLowerCase();
      } else if (sortBy === 'mfa') {
        aValue = a.mfaStatus?.mfaActive ? 1 : 0;
        bValue = b.mfaStatus?.mfaActive ? 1 : 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setUsers(filteredUsers);
    setActiveFiltersCount(filtersCount);
  };

  const refreshData = async () => {
    try {
      const mfaConfig = await useApiService.getUserPoolMFAConfig();
      setUserPoolMFAConfig(mfaConfig);
      await loadUsers(mfaConfig);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const handleSearch = () => {
    applyFiltersAndSort();
  };

  const handleSearchInputChange = (e) => {
    setSearchUsername(e.target.value);
  };

  // Apply search filter with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      applyFiltersAndSort();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchUsername]);

  const handleMfaFilterChange = (newFilter) => {
    setMfaFilter(newFilter);
  };

  const handleAccountStatusFilterChange = (newFilter) => {
    setAccountStatusFilter(newFilter);
  };

  // Apply filters whenever mfaFilter changes
  useEffect(() => {
    applyFiltersAndSort();
  }, [mfaFilter]);

  // Apply filters whenever accountStatusFilter changes
  useEffect(() => {
    applyFiltersAndSort();
  }, [accountStatusFilter]);

  const clearAllFilters = () => {
    setSearchUsername('');
    setMfaFilter('all');
    setAccountStatusFilter('all');
    setSortBy('email');
    setSortOrder('asc');
    setSelectedUser(null);
    applyFiltersAndSort(allUsers);
  };

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    applyFiltersAndSort();
  };



  const handleSetPermanentPassword = (username, userEmail) => {
    setInputModalData({
      title: 'Set Permanent Password',
      message: `Enter permanent password for ${userEmail}:`,
      placeholder: 'Min 8 chars, uppercase, lowercase, number',
      onConfirm: async (password) => {
        if (!password) return;
        try {
          await useApiService.setPermanentPassword(username, password);
          setMessage(`Permanent password set for ${userEmail}.`);
          await refreshData();
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
  };

  const handleForcePasswordReset = (username, userEmail) => {
    setInputModalData({
      title: 'Force Password Reset',
      message: `Enter new temporary password for ${userEmail}:`,
      placeholder: 'Min 8 chars, uppercase, lowercase, number',
      onConfirm: async (password) => {
        if (!password) return;
        try {
          await useApiService.resetPassword(username, password);
          setMessage(`Password reset to '${password}' for ${userEmail}. User must change on next login.`);
          await refreshData();
        } catch (error) {
          setMessage(`Error forcing password reset: ${error.message}`);
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
  };

  const handleResetTOTP = (username, userEmail) => {
    const user = selectedUser;
    const userName = user.Attributes?.find(attr => attr.Name === 'name')?.Value || 'N/A';
    const userCompany = user.Attributes?.find(attr => attr.Name === 'profile')?.Value || 'N/A';
    
    setConfirmModalData({
      title: '⚠️ Reset MFA - Warning',
      message: `Reset MFA for ${userEmail}?\n\n⚠️ Important: User will be deleted and recreated`,
      isWarning: true,
      onConfirm: async () => {
        setShowConfirmModal(false);
        setInputModalData({
          title: 'Set Temporary Password',
          message: `Enter temporary password for recreated user ${userEmail}:`,
          placeholder: 'Min 8 chars, uppercase, lowercase, number',
          onConfirm: async (tempPassword) => {
            if (!tempPassword) return;
            try {
              setMessage('Recreating user...');
              await useApiService.recreateUser(username, tempPassword);
              setMessage(`User ${userEmail} has been recreated successfully.`);
              await refreshData();
              
              // Show user info modal after successful recreation
              setConfirmModalData({
                title: '✅ User Recreated Successfully',
                message: '',
                isUserInfo: true,
                userInfo: {
                  email: userEmail,
                  name: userName,
                  company: userCompany,
                  tempPassword: tempPassword
                },
                onConfirm: () => setShowConfirmModal(false),
                onCancel: () => setShowConfirmModal(false)
              });
              setShowConfirmModal(true);
            } catch (error) {
              setMessage(`Error recreating user: ${error.message}`);
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
      },
      onCancel: () => setShowConfirmModal(false)
    });
    setShowConfirmModal(true);
  };



  const handleEnableMFA = async (username, userEmail) => {
    setConfirmModalData({
      title: 'Enable MFA',
      message: `This will enable TOTP MFA for ${userEmail}. Continue?`,
      onConfirm: async () => {
        try {
          // Auto-switch to OPTIONAL if needed
          if (userPoolMFAConfig && userPoolMFAConfig.mfaConfiguration === 'ON') {
            setMessage('Switching to OPTIONAL mode...');
            await apiService.setUserPoolMFAConfig('OPTIONAL');
            
            // Wait and verify the switch completed
            let attempts = 0;
            let configSwitched = false;
            while (attempts < 10 && !configSwitched) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              const newConfig = await apiService.getUserPoolMFAConfig();
              if (newConfig.mfaConfiguration === 'OPTIONAL') {
                setUserPoolMFAConfig(newConfig);
                configSwitched = true;
                setMessage('Switched to OPTIONAL mode. Enabling MFA...');
              }
              attempts++;
            }
            
            if (!configSwitched) {
              throw new Error('Failed to switch to OPTIONAL mode');
            }
          } else {
            setMessage('Enabling MFA...');
          }
          
          await useApiService.enableMFA(username);
          setMessage(`TOTP MFA enabled for ${userEmail}.`);
          await refreshData();
        } catch (error) {
          setMessage(`Error enabling MFA: ${error.message}`);
        }
        setShowConfirmModal(false);
      },
      onCancel: () => setShowConfirmModal(false)
    });
    setShowConfirmModal(true);
  };

  const handleDisableMFA = (username, userEmail) => {
    setConfirmModalData({
      title: 'Disable MFA',
      message: `This will disable TOTP MFA for ${userEmail}. They will no longer need MFA to login. Continue?`,
      onConfirm: async () => {
        try {
          // Auto-switch to OPTIONAL if needed
          if (userPoolMFAConfig && userPoolMFAConfig.mfaConfiguration === 'ON') {
            setMessage('Switching to OPTIONAL mode...');
            await apiService.setUserPoolMFAConfig('OPTIONAL');
            
            // Wait and verify the switch completed
            let attempts = 0;
            let configSwitched = false;
            while (attempts < 10 && !configSwitched) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              const newConfig = await apiService.getUserPoolMFAConfig();
              if (newConfig.mfaConfiguration === 'OPTIONAL') {
                setUserPoolMFAConfig(newConfig);
                configSwitched = true;
                setMessage('Switched to OPTIONAL mode. Disabling MFA...');
              }
              attempts++;
            }
            
            if (!configSwitched) {
              throw new Error('Failed to switch to OPTIONAL mode');
            }
          } else {
            setMessage('Disabling MFA...');
          }
          
          await useApiService.disableMFA(username);
          setMessage(`TOTP MFA disabled for ${userEmail}.`);
          setShowConfirmModal(false);
          
          // Immediately prompt for password reset since disabling MFA corrupts password
          setInputModalData({
            title: 'Set Password After MFA Disable',
            message: `MFA disabled. Set new password for ${userEmail} to allow login:`,
            placeholder: 'Min 8 chars, uppercase, lowercase, number',
            onConfirm: async (password) => {
              if (!password) return;
              try {
                await useApiService.resetPassword(username, password);
                setMessage(`MFA disabled and password set to '${password}' for ${userEmail}. User must change on next login.`);
                await refreshData();
              } catch (error) {
                setMessage(`Error setting password: ${error.message}`);
              }
              setShowInputModal(false);
              setInputValue('');
            },
            onCancel: () => {
              setShowInputModal(false);
              setInputValue('');
              setMessage('MFA disabled. User may need password reset to login.');
              refreshData();
            }
          });
          setShowInputModal(true);
          
        } catch (error) {
          setMessage(`Error disabling MFA: ${error.message}`);
          setShowConfirmModal(false);
        }
      },
      onCancel: () => setShowConfirmModal(false)
    });
    setShowConfirmModal(true);
  };



  const handleDeleteUser = (username, userEmail) => {
    setConfirmModalData({
      title: 'Delete User',
      message: `Are you sure you want to permanently delete user ${userEmail}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await apiService.deleteUser(username);
          setMessage(`User ${userEmail} has been deleted successfully.`);
          applyFiltersAndSort();
        } catch (error) {
          setMessage(`Error deleting user: ${error.message}`);
        }
        setShowConfirmModal(false);
      },
      onCancel: () => setShowConfirmModal(false)
    });
    setShowConfirmModal(true);
  };

  const handleEnableUser = (username, userEmail) => {
    setConfirmModalData({
      title: 'Enable User',
      message: `Enable user ${userEmail}? They will be able to sign in.`,
      onConfirm: async () => {
        try {
          await useApiService.enableUser(username);
          setMessage(`User ${userEmail} has been enabled.`);
          await refreshData();
        } catch (error) {
          setMessage(`Error enabling user: ${error.message}`);
        }
        setShowConfirmModal(false);
      },
      onCancel: () => setShowConfirmModal(false)
    });
    setShowConfirmModal(true);
  };

  const handleDisableUser = (username, userEmail) => {
    setConfirmModalData({
      title: 'Disable User',
      message: `Disable user ${userEmail}? They will not be able to sign in.`,
      onConfirm: async () => {
        try {
          await useApiService.disableUser(username);
          setMessage(`User ${userEmail} has been disabled.`);
          await refreshData();
        } catch (error) {
          setMessage(`Error disabling user: ${error.message}`);
        }
        setShowConfirmModal(false);
      },
      onCancel: () => setShowConfirmModal(false)
    });
    setShowConfirmModal(true);
  };

  const handleTogglePoolMFA = () => {
    if (!userPoolMFAConfig) return;
    
    const currentConfig = userPoolMFAConfig.mfaConfiguration;
    const newConfig = currentConfig === 'ON' ? 'OPTIONAL' : 'ON';
    const displayCurrent = currentConfig === 'ON' ? 'REQUIRED' : currentConfig;
    const displayNew = newConfig === 'ON' ? 'REQUIRED' : newConfig;
    
    setConfirmModalData({
      title: 'Change MFA Configuration',
      message: `Change MFA configuration from ${displayCurrent} to ${displayNew}?`,
      onConfirm: async () => {
        try {
          setMessage('Updating MFA configuration...');
          await apiService.setUserPoolMFAConfig(newConfig);
          setMessage(`MFA configuration updated to ${displayNew}.`);
          refreshData();
        } catch (error) {
          setMessage(`Error updating MFA configuration: ${error.message}`);
        }
        setShowConfirmModal(false);
      },
      onCancel: () => setShowConfirmModal(false)
    });
    setShowConfirmModal(true);
  };

  const handleCompareMFA = () => {
    setInputModalData({
      title: 'Debug MFA Settings',
      message: 'Enter two usernames to compare (working user, non-working user):',
      placeholder: 'user1@example.com,user2@example.com',
      onConfirm: async (input) => {
        if (!input) return;
        const [workingUser, nonWorkingUser] = input.split(',').map(u => u.trim());
        if (!workingUser || !nonWorkingUser) {
          setMessage('Please enter two usernames separated by comma');
          return;
        }
        try {
          await compareMFASettings(workingUser, nonWorkingUser);
          setMessage('MFA comparison logged to console. Check browser console for details.');
        } catch (error) {
          setMessage(`Error comparing MFA: ${error.message}`);
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
  };

  const handleFixMFAEnforcement = async () => {
    try {
      const result = await fixMFAEnforcement();
      setMessage(`${result.issue}. ${result.solution}. ${result.recommendation}`);
      console.log('MFA Enforcement Analysis:', result);
    } catch (error) {
      setMessage(`Error analyzing MFA enforcement: ${error.message}`);
    }
  };







  useEffect(() => {
    refreshData();
    
    // Set up callback for refresh after MFA switch
    window.refreshAfterMFASwitch = () => {
      setTimeout(() => {
        refreshData();
      }, 1000);
    };
    
    // Cleanup
    return () => {
      delete window.refreshAfterMFASwitch;
    };
  }, []);

  return (
    <div className="admin-page">
      <div className="header">
        <h1>User Management</h1>
        {userPoolMFAConfig && (
          <div className={`mfa-config-display ${userPoolMFAConfig.mfaConfiguration.toLowerCase()}`}>
            <p>MFA Configuration: <strong>{userPoolMFAConfig.mfaConfiguration === 'ON' ? 'REQUIRED' : userPoolMFAConfig.mfaConfiguration}</strong> <span className="enabled-status">ENABLED</span></p>
            <div className="mfa-actions">
              {(userPoolMFAConfig.mfaConfiguration === 'ON' || userPoolMFAConfig.mfaConfiguration === 'OPTIONAL') && (
                <button onClick={handleTogglePoolMFA} className="aws-button aws-button-primary">
                  Switch to MFA {userPoolMFAConfig.mfaConfiguration === 'ON' ? 'OPTIONAL' : 'REQUIRED'} Configuration
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="search-section">
        <div className="search-header">
          <div className="search-main">
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Search by email, name, or company..."
                value={searchUsername}
                onChange={handleSearchInputChange}
                className="search-input"
              />
            </div>
            <div className="filter-actions">
              <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} 
                className={`filter-action-btn filter-toggle-btn ${showAdvancedFilters ? 'active' : ''}`}
              >
                Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </button>
              <button onClick={clearAllFilters} className="filter-action-btn clear-btn">
                Clear All
              </button>
              <button onClick={refreshData} className="filter-action-btn refresh-btn">
                Refresh
              </button>
            </div>
          </div>
          
          {showAdvancedFilters && (
            <div className="advanced-filters">
              <div className="filter-row">
                <div className="filter-group">
                  <label>MFA Status:</label>
                  <select 
                    value={mfaFilter} 
                    onChange={(e) => handleMfaFilterChange(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="active">MFA Active</option>
                    <option value="inactive">MFA Inactive</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Account Status:</label>
                  <select 
                    value={accountStatusFilter} 
                    onChange={(e) => handleAccountStatusFilterChange(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
        

      </div>

      {message && (
        <div className={`message ${message.includes('Switch to MFA Configuration: OPTIONAL') ? 'error-message' : ''}`}>
          {message}
        </div>
      )}

      {showConfirmModal && confirmModalData && (
        <div className="confirm-modal">
          <div className={`confirm-modal-content ${confirmModalData.isWarning ? 'warning-modal' : ''} ${confirmModalData.isUserInfo ? 'user-info-modal' : ''}`}>
            {confirmModalData.isWarning && (
              <div className="warning-icon">⚠️</div>
            )}
            {confirmModalData.isUserInfo && (
              <div className="success-icon-modal">✅</div>
            )}
            <h3>{confirmModalData.title}</h3>
            {confirmModalData.isUserInfo ? (
              <div className="user-info-display">
                <div className="info-grid">
                  <div className="info-row">
                    <span className="info-label">Email:</span>
                    <span className="info-value">{confirmModalData.userInfo.email}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Name:</span>
                    <span className="info-value">{confirmModalData.userInfo.name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Company:</span>
                    <span className="info-value">{confirmModalData.userInfo.company}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Temporary Password:</span>
                    <span className="info-value password-display">{confirmModalData.userInfo.tempPassword}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className="info-value status-recreated">Recreated - Password change required</span>
                  </div>
                </div>
                <button 
                  onClick={() => navigator.clipboard.writeText(`Email: ${confirmModalData.userInfo.email}\nName: ${confirmModalData.userInfo.name}\nCompany: ${confirmModalData.userInfo.company}\nTemporary Password: ${confirmModalData.userInfo.tempPassword}\nStatus: Recreated - Password change required`)}
                  className="copy-user-info-btn"
                >
                  📋 Copy User Info
                </button>
              </div>
            ) : (
              <p>{confirmModalData.message}</p>
            )}
            <div className="confirm-modal-buttons">
              {!confirmModalData.isUserInfo && (
                <button onClick={confirmModalData.onCancel} className="cancel-btn">
                  Cancel
                </button>
              )}
              <button onClick={confirmModalData.onConfirm} className={confirmModalData.isUserInfo ? 'ok-btn' : 'confirm-btn'}>
                {confirmModalData.isUserInfo ? 'OK' : 'Confirm'}
              </button>
            </div>
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



      <div className="users-section">
        <div className="users-header">
          <h2>Users ({selectedUser ? 1 : users.length} of {allUsers.length})</h2>
          <div className="header-actions">
            {activeFiltersCount > 0 && (
              <div className="active-filters-info">
                <span className="filters-badge">{activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} applied</span>
              </div>
            )}
            <div className="user-actions">
              <select 
                onChange={(e) => {
                  const action = e.target.value;
                  if (!selectedUser || !action) return;
                  const userEmail = selectedUser.Attributes?.find(attr => attr.Name === 'email')?.Value || selectedUser.Username;
                  if (action === 'setPermanentPassword') {
                    handleSetPermanentPassword(selectedUser.Username, userEmail);
                  } else if (action === 'resetPassword') {
                    handleForcePasswordReset(selectedUser.Username, userEmail);
                  } else if (action === 'resetMFA') {
                    handleResetTOTP(selectedUser.Username, userEmail);
                  } else if (action === 'enableMFA') {
                    handleEnableMFA(selectedUser.Username, userEmail);
                  } else if (action === 'disableMFA') {
                    handleDisableMFA(selectedUser.Username, userEmail);
                  } else if (action === 'enableUser') {
                    handleEnableUser(selectedUser.Username, userEmail);
                  } else if (action === 'disableUser') {
                    handleDisableUser(selectedUser.Username, userEmail);
                  }
                  e.target.value = '';
                }}
                className="user-action-select"
                disabled={!selectedUser}
                defaultValue=""
              >
                <option value="" disabled>
                  {selectedUser ? 'Select Action' : 'Select a user first'}
                </option>
                <option value="setPermanentPassword">Set Permanent Password</option>
                <option value="resetPassword">Reset Temporary Password</option>
                <option value="resetMFA">Reset MFA (Recreate User)</option>
                <option value="enableMFA">Enable MFA</option>
                <option value="disableMFA">Disable MFA</option>
                <option value="enableUser">Enable User</option>
                <option value="disableUser">Disable User</option>
              </select>
            </div>
          </div>
        </div>
        {users.length === 0 ? (
          <p>No users found</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="checkbox-col"></th>
                <th 
                  className={`sortable-header ${sortBy === 'email' ? 'active' : ''}`}
                  onClick={() => handleSortChange('email')}
                >
                  <div className="header-content">
                    <span>Username (Email)</span>
                    {sortBy === 'email' && (
                      <span className="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th>Password Status</th>
                <th>Account Status</th>
                {userPoolMFAConfig && userPoolMFAConfig.mfaConfiguration === 'OPTIONAL' && (
                  <th 
                    className={`sortable-header ${sortBy === 'mfa' ? 'active' : ''}`}
                    onClick={() => handleSortChange('mfa')}
                  >
                    <div className="header-content">
                      <span>MFA Status</span>
                      {sortBy === 'mfa' && (
                        <span className="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                )}
                <th>Company</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr 
                  key={user.Username} 
                  className={selectedUser?.Username === user.Username ? 'selected-row' : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedUser?.Username === user.Username}
                      onChange={() => {
                        if (selectedUser?.Username === user.Username) {
                          setSelectedUser(null); // Unselect if clicking same user
                        } else {
                          setSelectedUser(user); // Select new user
                        }
                      }}
                      className="user-select-checkbox"
                    />
                  </td>
                  <td>{user.Attributes?.find(attr => attr.Name === 'email')?.Value || user.Username}</td>
                  <td>{user.UserStatus}</td>
                  <td>
                    <span className={`user-enabled-status ${user.Enabled ? 'enabled' : 'disabled'}`}>
                      {user.Enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  {userPoolMFAConfig && userPoolMFAConfig.mfaConfiguration === 'OPTIONAL' && (
                    <td>
                      <span className={`mfa-status ${user.mfaStatus?.mfaActive ? 'mfa-active' : 'mfa-inactive'}`}>
                        {user.mfaStatus?.mfaActive ? 'MFA Active' : 'MFA Inactive'}
                      </span>
                    </td>
                  )}
                  <td>
                    {user.Attributes?.find(attr => attr.Name === 'profile')?.Value || 'N/A'}
                  </td>
                  <td>
                    {user.Attributes?.find(attr => attr.Name === 'name')?.Value || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminPage;