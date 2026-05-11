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
  const [loadingDemoEmail, setLoadingDemoEmail] = useState(null);
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

  // One-click demo login: fill the form AND sign in immediately.
  // This avoids the fill → click sequence where browser autofill can overwrite
  // the password field between clicks.
  const handleDemoLogin = async (demoEmail, demoPassword) => {
    setError('');
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoadingDemoEmail(demoEmail);
    try {
      const userData = await login(demoEmail, demoPassword);
      navigate(getDashboardPath(userData.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoadingDemoEmail(null);
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

  // Full seeded roster — matches server/seed.js. Click any row to prefill the form.
  const demoCredentialGroups = [
    {
      role: 'Admin',
      password: 'admin123',
      defaultOpen: true,
      accounts: [
        { name: 'Rohit Ritthe', email: 'rohit.ritthe@ewaste.com', tag: 'admin' },
      ],
    },
    {
      role: 'Small users',
      password: 'user123',
      accounts: [
        { name: 'Hrithik Sharma',   email: 'hrithik@ewaste.com',         tag: 'Kothrud' },
        { name: 'Kaushal Patil',    email: 'kaushal@ewaste.com',         tag: 'Viman Nagar' },
        { name: 'Tejas Shinde',     email: 'tejas.shinde@ewaste.com',    tag: 'Karve Nagar' },
        { name: 'Suraj Salunkhe',   email: 'suraj.salunkhe@ewaste.com',  tag: 'Sinhagad Rd' },
        { name: 'Shubham Lohar',    email: 'shubham.lohar@ewaste.com',   tag: 'Hinjewadi' },
        { name: 'Anita Kulkarni',   email: 'anita.kulkarni@ewaste.com',  tag: 'Sadashiv Peth' },
        { name: 'Rahul Joshi',      email: 'rahul.joshi@ewaste.com',     tag: 'Kalyani Nagar' },
        { name: 'Pooja Desai',      email: 'pooja.desai@ewaste.com',     tag: 'Shivaji Nagar' },
        { name: 'Nikhil Mehta',     email: 'nikhil.mehta@ewaste.com',    tag: 'Hadapsar' },
        { name: 'Snehal Rao',       email: 'snehal.rao@ewaste.com',      tag: 'Balewadi' },
        { name: 'Ajay Bhosale',     email: 'ajay.bhosale@ewaste.com',    tag: 'Parvati' },
        { name: 'Isha Nair',        email: 'isha.nair@ewaste.com',       tag: 'Bavdhan' },
      ],
    },
    {
      role: 'Local collectors',
      password: 'collector123',
      accounts: [
        { name: 'Sahil Wankhede',   email: 'sahil.wankhede@ewaste.com',  tag: 'Deccan Gymkhana' },
        { name: 'Rohan Pawar',      email: 'rohan.pawar@ewaste.com',     tag: 'Baner' },
        { name: 'Aniket Jagtap',    email: 'aniket.jagtap@ewaste.com',   tag: 'Warje Chowk' },
        { name: 'Prasad More',      email: 'prasad.more@ewaste.com',     tag: 'Vishrantwadi' },
        { name: 'Sandeep Ghule',    email: 'sandeep.ghule@ewaste.com',   tag: 'Fursungi' },
        { name: 'Omkar Bagal',      email: 'omkar.bagal@ewaste.com',     tag: 'Pashan' },
        { name: 'Vishal Mohite',    email: 'vishal.mohite@ewaste.com',   tag: 'Bibwewadi' },
        { name: 'Mayur Sonar',      email: 'mayur.sonar@ewaste.com',     tag: 'Yerawada' },
        { name: 'Kiran Borade',     email: 'kiran.borade@ewaste.com',    tag: 'Wakad' },
        { name: 'Tushar Sawant',    email: 'tushar.sawant@ewaste.com',   tag: 'Dhankawadi' },
      ],
    },
    {
      role: 'Hubs',
      password: 'hub123',
      accounts: [
        { name: 'Vedant Rane (Hub A)',      email: 'vedant.rane@ewaste.com',      tag: 'Koregaon Park' },
        { name: 'Vipul Ware (Hub B)',       email: 'vipul.ware@ewaste.com',       tag: 'Warje' },
        { name: 'Aditya Joshi (Hub C)',     email: 'aditya.joshi@ewaste.com',     tag: 'Hinjewadi' },
        { name: 'Neha Deshmukh (Hub D)',    email: 'neha.deshmukh@ewaste.com',    tag: 'Kharadi' },
        { name: 'Amol Gaikwad (Hub E)',     email: 'amol.gaikwad@ewaste.com',     tag: 'Aundh' },
        { name: 'Siddharth Kamble (Hub F)', email: 'siddharth.kamble@ewaste.com', tag: 'Hadapsar' },
      ],
    },
    {
      role: 'Delivery agents',
      password: 'delivery123',
      accounts: [
        { name: 'Ajit Mane',        email: 'ajit.mane@ewaste.com',        tag: 'Camp / MG Rd' },
        { name: 'Prathamesh Kale',  email: 'prathamesh.kale@ewaste.com',  tag: 'Pashan' },
        { name: 'Akash Patole',     email: 'akash.patole@ewaste.com',     tag: 'Parvati Paytha' },
        { name: 'Rohit Lokhande',   email: 'rohit.lokhande@ewaste.com',   tag: 'Kalyani Nagar' },
        { name: 'Swapnil Kadam',    email: 'swapnil.kadam@ewaste.com',    tag: 'Kothrud Depot' },
        { name: 'Chetan Salvi',     email: 'chetan.salvi@ewaste.com',     tag: 'Wakad' },
        { name: 'Nitin Pisal',      email: 'nitin.pisal@ewaste.com',      tag: 'Magarpatta' },
        { name: 'Dinesh Pandit',    email: 'dinesh.pandit@ewaste.com',    tag: 'Balewadi Phata' },
        { name: 'Mahesh Ghadge',    email: 'mahesh.ghadge@ewaste.com',    tag: 'Katraj' },
        { name: 'Yogesh Rathod',    email: 'yogesh.rathod@ewaste.com',    tag: 'Yerawada' },
      ],
    },
    {
      role: 'Recycler companies',
      password: 'recycler123',
      accounts: [
        { name: 'EcoCycle Recyclers Pvt Ltd', email: 'ops@ecocycle.in',              tag: 'Talegaon MIDC · ₹48/kg' },
        { name: 'GreenMetal Industries',      email: 'procurement@greenmetal.in',    tag: 'Chakan MIDC · ₹55/kg' },
        { name: 'ReNewTech Solutions',        email: 'sales@renewtech.io',           tag: 'Phursungi · ₹52/kg' },
        { name: 'Vasundhara E-Waste',         email: 'contact@vasundhara-ewaste.in', tag: 'Bhosari MIDC · ₹50/kg' },
        { name: 'Triveni Recycling',          email: 'ops@trivenirecycling.in',      tag: 'Alandi Rd · ₹46/kg' },
        { name: 'CircuitLoop Industries',     email: 'hello@circuitloop.co',         tag: 'Pimpri · ₹58/kg' },
        { name: 'EcoRevive Resources',        email: 'info@ecorevive.in',            tag: 'Ranjangaon · ₹54/kg' },
        { name: 'MetalMine Recyclers',        email: 'procurement@metalmine.co.in',  tag: 'Uruli Kanchan · ₹60/kg' },
        { name: 'PlasticPulse Solutions',     email: 'business@plasticpulse.in',     tag: 'Kharadi EPIP · ₹42/kg' },
        { name: 'Saksham Green Tech',         email: 'orders@sakshamgreen.in',       tag: 'Bhosari · ₹53/kg' },
      ],
    },
  ];

  const totalAccounts = demoCredentialGroups.reduce((n, g) => n + g.accounts.length, 0);

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
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm text-muted-foreground">Demo credentials</p>
                <span className="text-xs text-muted-foreground">{totalAccounts} accounts · click to sign in</span>
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {demoCredentialGroups.map((group) => (
                  <details
                    key={group.role}
                    open={group.defaultOpen}
                    className="rounded-lg border border-border bg-card group"
                  >
                    <summary className="flex items-center justify-between cursor-pointer select-none px-3 py-2 text-sm hover:bg-muted/60 rounded-lg">
                      <span className="font-medium text-foreground">
                        {group.role}
                        <span className="ml-1.5 text-xs text-muted-foreground">({group.accounts.length})</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                        pw: {group.password}
                      </span>
                    </summary>
                    <div className="grid gap-1 p-2 pt-0">
                      {group.accounts.map((acc) => {
                        const isBusy = loadingDemoEmail === acc.email;
                        const anyBusy = !!loadingDemoEmail || isLoading;
                        return (
                          <button
                            key={acc.email}
                            type="button"
                            disabled={anyBusy}
                            onClick={() => handleDemoLogin(acc.email, group.password)}
                            className={`text-left px-2.5 py-1.5 rounded border transition-colors ${
                              isBusy
                                ? 'border-primary bg-primary/10'
                                : 'border-border/70 hover:bg-primary/5 hover:border-primary/40'
                            } ${anyBusy && !isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground text-xs truncate flex items-center gap-1.5">
                                {isBusy && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                                {acc.name}
                              </span>
                              {acc.tag && !isBusy && (
                                <span className="text-[10px] text-muted-foreground truncate">{acc.tag}</span>
                              )}
                              {isBusy && (
                                <span className="text-[10px] text-primary font-medium">Signing in…</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">{acc.email}</p>
                          </button>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Tip: click any account above to sign in directly — no need to press the Login button.
              </p>
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
