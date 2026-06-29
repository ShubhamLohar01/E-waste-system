import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Coins,
  LogOut,
  ArrowLeft,
  Recycle,
  Package,
  CheckCircle2,
} from "lucide-react";

export default function RewardWallet() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ balanceRs: 0, entries: [] });
  const [collectedWaste, setCollectedWaste] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiFetch = useCallback(
    (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [earningsRes, collectedRes] = await Promise.all([
          apiFetch("/api/earnings/mine"),
          apiFetch("/api/intent/collected-waste"),
        ]);
        if (earningsRes.ok) {
          setData(await earningsRes.json());
        }
        if (collectedRes.ok) {
          const d = await collectedRes.json();
          setCollectedWaste(d.items ?? []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiFetch]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Coins className="w-10 h-10 animate-bounce text-primary" />
          <p className="text-muted-foreground">Loading wallet…</p>
        </div>
      </div>
    );
  }

  const balance = Math.round(data.balanceRs ?? 0);
  const entries = data.entries ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/small-user" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-primary" />
              Earnings Wallet
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Balance Card */}
        <div className="relative rounded-2xl bg-gradient-to-br from-primary to-accent p-6 sm:p-8 text-white overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <p className="text-white/70 text-sm font-medium mb-1">Total Earnings</p>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-bold tracking-tight">₹{balance.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-white/80">
              <Recycle className="w-4 h-4 flex-shrink-0" />
              <span>{user?.name} · E-Waste Hub Wallet</span>
            </div>
          </div>
        </div>

        {/* Earnings ledger */}
        <div>
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" />
            Payout history
          </h3>
          {entries.length === 0 ? (
            <div className="py-16 text-center">
              <Coins className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No payouts yet</h3>
              <p className="text-sm text-muted-foreground mb-4">You're paid when a recycler buys your item.</p>
              <Link to="/dashboard/small-user">
                <Button className="gap-2">
                  <Recycle className="w-4 h-4" />
                  Submit E-Waste
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground">{entry.category || "Item"}</td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground">
                        {String(entry.type || "").replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-600">
                        +₹{Math.round(entry.amountRs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Collected waste by collector */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Collected waste by collector
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            E-waste you submitted that has been picked up by a collector
          </p>
          {collectedWaste.length === 0 ? (
            <div className="py-8 text-center rounded-lg bg-muted/30 border border-dashed border-border">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No collected items yet</p>
              <p className="text-xs text-muted-foreground mt-1">When a collector picks up your e-waste, it will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collectedWaste.map((item) => {
                const collectedEntry = item.traceability?.find((t) => t.action === "collected");
                const collectedAt = collectedEntry?.timestamp
                  ? new Date(collectedEntry.timestamp).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—";
                return (
                  <div
                    key={item._id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Recycle className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.actualQty} {item.unit} · Collected {collectedAt}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 capitalize">
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
