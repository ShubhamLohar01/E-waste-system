import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/context/AuthContext';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { AlertCircle, Loader2, Recycle, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gmailEmail, setGmailEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const { login, loginWithGoogle, sendEmailCode, verifyEmailCode } = useAuth();
  const navigate = useNavigate();

  const getDashboardPath = (role) => {
    const routes = {
      small_user: '/dashboard/small-user',
      local_collector: '/dashboard/collector',
      hub: '/dashboard/hub',
      delivery_worker: '/dashboard/delivery',
      recycler: '/dashboard/recycler',
      bulk_generator: '/dashboard/bulk-generator',
      admin: '/dashboard/admin',
    };
    return routes[role] || '/';
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const userData = await login(email, password);
      navigate(getDashboardPath(userData.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async (credential) => {
    setError('');
    setIsLoading(true);
    try {
      const userData = await loginWithGoogle(credential);
      navigate(getDashboardPath(userData.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmailCode = async () => {
    if (!gmailEmail.trim()) {
      setError('Enter your Gmail address');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await sendEmailCode(gmailEmail.trim());
      setEmailCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e) => {
    e.preventDefault();
    if (!gmailEmail.trim() || emailCode.length !== 6) {
      setError('Enter email and 6-digit code');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const result = await verifyEmailCode(gmailEmail.trim(), emailCode);
      if (result.user && result.token) {
        navigate(getDashboardPath(result.user.role));
      } else if (result.needsRegister && result.verifyToken) {
        navigate('/register', {
          state: { method: 'email', verifyToken: result.verifyToken, email: gmailEmail.trim() },
        });
      } else {
        setError('Could not sign in. Try again or register.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const demoCredentials = [
    { email: 'admin@ewaste.com', password: 'admin123', role: 'Admin' },
    { email: 'user1@ewaste.com', password: 'user123', role: 'Small User' },
    { email: 'collector1@ewaste.com', password: 'collector123', role: 'Collector' },
    { email: 'hub1@ewaste.com', password: 'hub123', role: 'Hub' },
    { email: 'delivery1@ewaste.com', password: 'delivery123', role: 'Delivery Worker' },
    { email: 'recycler1@ewaste.com', password: 'recycler123', role: 'Recycler' },
    { email: 'bulk1@ewaste.com', password: 'bulk123', role: 'Bulk Generator' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-12">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Recycle className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground">E-Waste Hub</span>
        </Link>

        <h1 className="text-2xl font-bold text-foreground mb-1">Welcome Back</h1>
        <p className="text-muted-foreground mb-6">Sign in to your account</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <div className="mb-4">
          <GoogleSignInButton
            mode="signin"
            onSuccess={handleGoogleSignIn}
            onError={(e) => setError(e.message)}
            className="flex justify-center"
          />
        </div>

        <p className="text-center text-sm text-muted-foreground mb-4">or sign in with email</p>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="w-4 h-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="gmail" className="gap-1.5">
              <Mail className="w-4 h-4" />
              Gmail code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full gap-2">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</> : 'Login'}
              </Button>
            </form>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Demo credentials:</p>
              <div className="grid gap-1.5">
                {demoCredentials.map((cred) => (
                  <button
                    key={cred.email}
                    type="button"
                    onClick={() => { setEmail(cred.email); setPassword(cred.password); }}
                    className="text-left px-3 py-1.5 rounded hover:bg-muted text-xs border border-border"
                  >
                    <span className="font-medium text-foreground">{cred.role}</span>
                    <span className="text-muted-foreground ml-2">{cred.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gmail">
            {!emailCodeSent ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Gmail address</label>
                  <Input type="email" value={gmailEmail} onChange={(e) => setGmailEmail(e.target.value)} placeholder="you@gmail.com" />
                </div>
                <p className="text-xs text-muted-foreground">We'll send a 6-digit verification code to your inbox.</p>
                <Button type="button" onClick={handleSendEmailCode} disabled={isLoading} className="w-full gap-2">
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending code...</> : 'Send code to Gmail'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleVerifyEmailCode} className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {gmailEmail}</p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={emailCode} onChange={(value) => setEmailCode(value)}>
                    <InputOTPGroup className="gap-1">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" disabled={isLoading || emailCode.length !== 6} className="w-full gap-2">
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : 'Verify code'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { setEmailCodeSent(false); setEmailCode(''); }}>
                  Use different email
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">Register here</Link>
        </p>
      </div>
    </div>
  );
}
