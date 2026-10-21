import React, { createContext, useState, useContext, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  initAuth,
  isConfigured,
  hasValidToken,
  signIn as gisSignIn,
  signOut as gisSignOut,
  reauthorize as gisReauthorize,
  rememberEmail,
  subscribe,
  getAuthSnapshot,
} from '@/lib/google/auth';
import { getAbout } from '@/lib/google/drive';
import { resetDriveCache } from '@/api/db';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext();

// status: "loading" | "unconfigured" | "signedOut" | "signedIn"
export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState(isConfigured() ? 'loading' : 'unconfigured');
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  const authState = useSyncExternalStore(subscribe, getAuthSnapshot);

  const loadUser = useCallback(async () => {
    const about = await getAbout();
    const u = {
      email: about.emailAddress,
      full_name: about.displayName,
      photo_url: about.photoLink,
    };
    rememberEmail(u.email);
    setUser(u);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    if (!isConfigured()) return;
    initAuth()
      .then(() => setReady(true))
      .catch((e) => setAuthError(e.message));
    if (hasValidToken()) {
      loadUser().catch(() => setStatus('signedOut'));
    } else {
      setStatus('signedOut');
    }
  }, [loadUser]);

  // Call from a click handler.
  const login = async () => {
    setAuthError(null);
    try {
      await gisSignIn();
      await loadUser();
    } catch (e) {
      if (e?.code !== 'superseded') setAuthError(e.message || 'Sign-in failed.');
    }
  };

  const reauthorize = async () => {
    try {
      await gisReauthorize();
    } catch (e) {
      if (e?.code !== 'superseded') setAuthError(e.message || 'Sign-in failed.');
    }
  };

  const logout = () => {
    gisSignOut();
    resetDriveCache();
    queryClientInstance.clear();
    setUser(null);
    setStatus('signedOut');
  };

  return (
    <AuthContext.Provider value={{
      status,
      user,
      isAuthenticated: status === 'signedIn',
      ready,
      authError,
      needsReauth: authState.needsReauth,
      lastEmail: authState.email,
      login,
      logout,
      reauthorize,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
