import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, User, MapPin, Phone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import GoogleMapPicker from '@/components/GoogleMapPicker';

const ROLE_LABEL = {
  small_user: 'Small User',
  local_collector: 'Local Collector',
  hub: 'Hub',
  delivery_worker: 'Delivery Agent',
  recycler: 'Recycler',
  bulk_generator: 'Bulk Generator',
  admin: 'Admin',
};

export default function Profile() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState({ lat: null, lng: null, address: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await api.get('/api/auth/me');
        setMe(profile);
        setName(profile?.name || '');
        setPhone(profile?.phone || '');
        setLocation(profile?.location || { lat: null, lng: null, address: '' });
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const save = async () => {
    setMsg(null);
    setSaving(true);
    try {
      const body = { name, phone };
      if (location?.lat != null && location?.lng != null) body.location = location;
      else if (location?.address) body.location = { ...location, lat: 0, lng: 0 };
      await api.put('/api/auth/profile', body);
      setMsg({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const backToDashboard = () => {
    const routeByRole = {
      small_user: '/dashboard/small-user',
      local_collector: '/dashboard/collector',
      hub: '/dashboard/hub',
      delivery_worker: '/dashboard/delivery',
      recycler: '/dashboard/recycler',
      bulk_generator: '/dashboard/bulk-generator',
      admin: '/dashboard/admin',
    };
    navigate(routeByRole[user?.role] || '/');
  };

  if (!me)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <button onClick={backToDashboard} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </button>
          <span className="font-bold">My Profile</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <section className="p-5 rounded-lg border border-border bg-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Account
              </p>
              <p className="text-xl font-bold">{me.name}</p>
              <p className="text-sm text-muted-foreground">{me.email}</p>
            </div>
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-muted border border-border flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> {ROLE_LABEL[me.role] || me.role}
            </span>
          </div>
        </section>

        <section className="p-5 rounded-lg border border-border bg-card space-y-4">
          <h2 className="font-semibold">Edit profile</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Phone
              </label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91-…" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            <GoogleMapPicker value={location} onChange={setLocation} />
          </div>

          {msg && (
            <div
              className={`p-3 rounded text-sm border ${
                msg.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {msg.text}
            </div>
          )}

          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </Button>
        </section>

        <p className="text-xs text-muted-foreground text-center">
          Email and role cannot be changed here. Contact admin for role changes.
        </p>
      </main>
    </div>
  );
}
