import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/context/AuthContext';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { AlertCircle, Loader2, Recycle, Mail } from 'lucide-react';

const ROLES = [
  { value: 'small_user', label: 'Small Individual User', description: 'Submit e-waste and earn rewards' },
  { value: 'local_collector', label: 'Local Collector', description: 'Collect waste from multiple users' },
  { value: 'hub', label: 'Main Hub', description: 'Verify and aggregate e-waste' },
  { value: 'delivery_worker', label: 'Delivery Worker', description: 'Transport waste to recyclers' },
  { value: 'recycler', label: 'Recycling Company', description: 'Submit demands and receive deliveries' },
  { value: 'bulk_generator', label: 'Bulk Generator', description: 'Large-scale e-waste management' },
];

export default function Register() {
  const location = useLocation();
  const state = location.state;

  const [method, setMethod] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'small_user',
    address: '',
  });
  const [gmailEmail, setGmailEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [verifyToken, setVerifyToken] = useState(null);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, loginWithGoogle, sendEmailCode, verifyEmailCode, registerWithEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (state?.method === 'email' && state?.verifyToken && state?.email) {
      setVerifyToken(state.verifyToken);
      setVerifiedEmail(state.email);
      setMethod('gmail');
    }
  }, [state]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEmailPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      await register(formData.name, formData.email, formData.password, formData.phone, formData.role, { lat: 0, lng: 0, address: formData.address });
      navigate('/dashboard/small-user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async (credential) => {
    setError('');
    setIsLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate('/dashboard/small-user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed');
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

  const handleVerifyEmailCodeThenRegister = async (e) => {
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
        navigate('/dashboard/small-user');
        return;
      }
      if (result.needsRegister && result.verifyToken) {
        setVerifyToken(result.verifyToken);
        setVerifiedEmail(gmailEmail.trim());
        setMethod('gmail');
      } else {
        setError('Could not complete verification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteEmailRegister = async (e) => {
    e.preventDefault();
    if (!verifyToken) {
      setError('Session expired. Please start again.');
      return;
    }
    if (!formData.name.trim()) {
      setError('Full name is required');
      return;
    }
    if (!formData.address.trim()) {
      setError('Address is required');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await registerWithEmail(verifyToken, formData.name.trim(), formData.role, formData.address.trim());
      navigate('/dashboard/small-user');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm';

  const errorBlock = error ? (
    <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
      <p className="text-destructive text-sm">{error}</p>
    </div>
  ) : null;

  if (method === 'gmail' && verifyToken) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-md mx-auto px-4">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <Recycle className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">E-Waste Hub</span>
          </Link>
          <h2 className="text-2xl font-bold text-foreground mb-1">Complete registration</h2>
          <p className="text-muted-foreground mb-6">Email verified. Fill in your details below.</p>
          {errorBlock}
          <form onSubmit={handleCompleteEmailRegister} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Full Name <span className="text-destructive">*</span></label>
              <Input name="name" value={formData.name} onChange={handleChange} placeholder="Enter your full name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Role</label>
              <select name="role" value={formData.role} onChange={handleChange} className={inputClass} required>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Address <span className="text-destructive">*</span></label>
              <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Enter your full address" rows={3} className={inputClass} required />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full gap-2">
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : 'Create Account'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-lg mx-auto px-4">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Recycle className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground">E-Waste Hub</span>
        </Link>

        <h2 className="text-2xl font-bold text-foreground mb-1">Create Account</h2>
        <p className="text-muted-foreground mb-6">Sign up to get started</p>

        {errorBlock}

        <div className="mb-4">
          <GoogleSignInButton
            mode="signup"
            onSuccess={handleGoogleSignUp}
            onError={(e) => setError(e.message)}
            className="flex justify-center"
          />
        </div>

        <p className="text-center text-sm text-muted-foreground mb-4">or continue with email</p>

        <Tabs defaultValue="email_password" className="w-full" onValueChange={(v) => setMethod(v)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="email_password" className="gap-1.5">
              <Mail className="w-4 h-4" />
              Email & Password
            </TabsTrigger>
            <TabsTrigger value="gmail" className="gap-1.5">
              <Mail className="w-4 h-4" />
              Gmail code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email_password">
            <form onSubmit={handleEmailPasswordSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Your name" className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="user@example.com" className={inputClass} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Confirm Password</label>
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" className={inputClass} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+91-9000000000" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                  <select name="role" value={formData.role} onChange={handleChange} className={inputClass} required>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Your location" rows={2} className={inputClass} />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full gap-2">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : 'Create Account'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="gmail">
            {!emailCodeSent ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Gmail address</label>
                  <Input type="email" value={gmailEmail} onChange={(e) => setGmailEmail(e.target.value)} placeholder="you@gmail.com" />
                </div>
                <p className="text-xs text-muted-foreground">We'll send a 6-digit code to your inbox.</p>
                <Button type="button" onClick={handleSendEmailCode} disabled={isLoading} className="w-full gap-2">
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending code...</> : 'Send code to Gmail'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleVerifyEmailCodeThenRegister} className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {gmailEmail}</p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={emailCode} onChange={setEmailCode}>
                    <InputOTPGroup className="gap-1">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" disabled={isLoading || emailCode.length !== 6} className="w-full gap-2">
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : 'Verify & Continue'}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { setEmailCodeSent(false); setEmailCode(''); }}>
                  Use different email
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setFormData({ ...formData, role: r.value })}
              className={`px-2.5 py-1 rounded text-xs border ${
                formData.role === r.value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">Login here</Link>
        </p>
      </div>
    </div>
  );
}
