import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'small_user' | 'local_collector' | 'hub' | 'delivery_worker' | 'recycler' | 'bulk_generator' | 'admin';
  trustLevel: string;
  phone?: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface VerifyEmailCodeResult {
  token?: string;
  user?: User;
  needsRegister?: boolean;
  verifyToken?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  register: (name: string, email: string, password: string, phone: string, role: string, location?: any) => Promise<User>;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<VerifyEmailCodeResult>;
  registerWithEmail: (verifyToken: string, name: string, role: string, address?: string) => Promise<User>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Safely parse JSON from a Response; avoids "Unexpected end of JSON input" when body is empty or invalid. */
async function safeJson<T = unknown>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchUserProfile = async (authToken: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await safeJson<User>(response);
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

  const login = async (email: string, password: string): Promise<User> => {
    try {
      setError(null);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson<{ error?: string; token?: string; user?: User }>(response);
      if (!response.ok) {
        throw new Error(data?.error || response.statusText || 'Login failed');
      }
      if (!data?.token || !data?.user) throw new Error('Invalid response from server');

      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    phone: string,
    role: string,
    location?: any
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

      const data = await safeJson<{ error?: string; token?: string; user?: User }>(response);
      if (!response.ok) {
        throw new Error(data?.error || response.statusText || 'Registration failed');
      }
      if (!data?.token || !data?.user) throw new Error('Invalid response from server');

      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const loginWithGoogle = async (credential: string): Promise<User> => {
    setError(null);
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await safeJson<{ error?: string; token?: string; user?: User }>(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Google sign-in failed');
    }
    if (!data?.token || !data?.user) throw new Error('Invalid response from server');
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const sendEmailCode = async (email: string) => {
    setError(null);
    const response = await fetch('/api/auth/send-email-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await safeJson<{ success?: boolean; error?: string }>(response);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || 'Failed to send code');
    }
  };

  const verifyEmailCode = async (email: string, code: string): Promise<VerifyEmailCodeResult> => {
    setError(null);
    const response = await fetch('/api/auth/verify-email-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await safeJson<{
      error?: string;
      token?: string;
      user?: User;
      needsRegister?: boolean;
      verifyToken?: string;
    }>(response);
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
    verifyToken: string,
    name: string,
    role: string,
    address?: string
  ): Promise<User> => {
    setError(null);
    const response = await fetch('/api/auth/register-with-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifyToken, name, role, address }),
    });
    const data = await safeJson<{ error?: string; token?: string; user?: User }>(response);
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
