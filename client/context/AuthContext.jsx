import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(undefined);

/** Safely parse JSON from a Response; avoids "Unexpected end of JSON input" when body is empty or invalid. */
async function safeJson(response) {
  const text = await response.text();
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      // Verify token is still valid by fetching user profile
      fetchUserProfile(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserProfile = async (authToken) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await safeJson(response);
        if (userData) setUser(userData);
      } else {
        // Token is invalid
        localStorage.removeItem('auth_token');
        setToken(null);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      localStorage.removeItem('auth_token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson(response);
      if (!response.ok) {
        throw new Error(data?.error || response.statusText || 'Login failed');
      }
      if (!data?.token || !data?.user) throw new Error('Invalid response from server');

      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (
    name,
    email,
    password,
    phone,
    role,
    location
  ) => {
    try {
      setError(null);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          role,
          location,
        }),
      });

      const data = await safeJson(response);
      if (!response.ok) {
        throw new Error(data?.error || response.statusText || 'Registration failed');
      }
      if (!data?.token || !data?.user) throw new Error('Invalid response from server');

      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const loginWithGoogle = async (credential) => {
    setError(null);
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Google sign-in failed');
    }
    if (!data?.token || !data?.user) throw new Error('Invalid response from server');
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const sendEmailCode = async (email) => {
    setError(null);
    const response = await fetch('/api/auth/send-email-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await safeJson(response);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to send code');
    }
  };

  const verifyEmailCode = async (email, code) => {
    setError(null);
    const response = await fetch('/api/auth/verify-email-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Invalid code');
    }
    if (data?.token && data?.user) {
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return {
      token: data?.token,
      user: data?.user,
      needsRegister: data?.needsRegister,
      verifyToken: data?.verifyToken,
    };
  };

  const registerWithEmail = async (
    verifyToken,
    name,
    role,
    address
  ) => {
    setError(null);
    const response = await fetch('/api/auth/register-with-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifyToken, name, role, address }),
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Registration failed');
    }
    if (!data?.token || !data?.user) throw new Error('Invalid response');
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setToken(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        loginWithGoogle,
        register,
        sendEmailCode,
        verifyEmailCode,
        registerWithEmail,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
