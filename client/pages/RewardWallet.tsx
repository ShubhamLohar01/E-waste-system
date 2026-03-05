import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Coins,
  Award,
  TrendingUp,
  Flame,
  LogOut,
  ArrowLeft,
  Star,
  Recycle,
  Trophy,
  ChevronRight,
  Zap,
  Gift,
  Package,
  CheckCircle2,
} from "lucide-react";

interface HistoryEntry {
  action: string;
  points: number;
  inventoryId?: string;
  timestamp: string;
  category?: string;
  quantity?: number;
  unit?: string;
}

interface Badge {
  name: string;
  earnedAt: string;
}

interface Milestone {
  threshold: number;
  reached: boolean;
  rewardType: string;
}

interface RewardData {
  totalPoints: number;
  currentStreak: number;
  badges: Badge[];
  milestones: Milestone[];
  enrichedHistory: HistoryEntry[];
  tier: "Silver" | "Gold" | "Platinum";
  nextMilestone: {
    threshold: number;
    pointsNeeded: number;
    rewardType: string;
  } | null;
}

interface CollectedItem {
  _id: string;
  category: string;
  actualQty: number;
  unit: string;
  status: string;
  collectionId?: string;
  traceability?: Array<{ action: string; timestamp: string }>;
}

const TIER_CONFIG = {
  Silver: {
    gradient: "from-slate-400 to-slate-600",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
    icon: Star,
    benefits: ["Basic pickup scheduling", "Community forum access"],
  },
  Gold: {
    gradient: "from-yellow-400 to-amber-600",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-300",
    icon: Trophy,
    benefits: ["Standard pickup scheduling", "10% discount on partner services", "Community forum access"],
  },
  Platinum: {
    gradient: "from-purple-400 to-indigo-600",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-300",
    icon: Zap,
    benefits: ["Priority pickup scheduling", "20% discount on partner services", "Monthly newsletter", "Community recognition"],
  },
};

const BADGE_ICONS: Record<string, string> = {
  "First Step": "🌱",
  "Growing Green": "🌿",
  "Silver Champion": "🥈",
  "Gold Guardian": "🥇",
  "Platinum Pioneer": "🏆",
  "Diamond Advocate": "💎",
};

const ALL_BADGES = [
  { name: "First Step", threshold: 100 },
  { name: "Growing Green", threshold: 500 },
  { name: "Silver Champion", threshold: 1000 },
  { name: "Gold Guardian", threshold: 2500 },
  { name: "Platinum Pioneer", threshold: 5000 },
  { name: "Diamond Advocate", threshold: 10000 },
];

export default function RewardWallet() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [rewardData, setRewardData] = useState<RewardData | null>(null);
  const [collectedWaste, setCollectedWaste] = useState<CollectedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "badges">("overview");

  const apiFetch = useCallback(
    (url: string) =>
      fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rewardsRes, collectedRes] = await Promise.all([
          apiFetch("/api/intent/rewards"),
          apiFetch("/api/intent/collected-waste"),
        ]);
        if (rewardsRes.ok) {
          setRewardData(await rewardsRes.json());
        }
        if (collectedRes.ok) {
          const data = await collectedRes.json();
          setCollectedWaste(data.items ?? []);
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

  const points = rewardData?.totalPoints ?? 0;
  const streak = rewardData?.currentStreak ?? 0;
  const badges = rewardData?.badges ?? [];
  const milestones = rewardData?.milestones ?? [];
  const history = rewardData?.enrichedHistory ?? [];
  const tier = rewardData?.tier ?? "Silver";
  const nextMilestone = rewardData?.nextMilestone;
  const tierCfg = TIER_CONFIG[tier];
  const TierIcon = tierCfg.icon;

  const progressPct = nextMilestone
    ? Math.min(100, Math.round(((nextMilestone.threshold - nextMilestone.pointsNeeded) / nextMilestone.threshold) * 100))
    : 100;

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
              Reward Wallet
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
        {/* Wallet Card */}
        <div className={`relative rounded-2xl bg-gradient-to-br ${tierCfg.gradient} p-6 sm:p-8 text-white overflow-hidden shadow-lg`}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-white/70 text-sm font-medium mb-1">Total Coins</p>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold tracking-tight">{points.toLocaleString()}</span>
                  <span className="text-white/80 text-lg mb-1">coins</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5">
                  <TierIcon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{tier} Tier</span>
                </div>
                {streak > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5">
                    <Flame className="w-4 h-4 text-orange-300" />
                    <span className="text-sm font-semibold">{streak} streak</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-white/80 mb-6">
              <Recycle className="w-4 h-4 flex-shrink-0" />
              <span>{user?.name} · E-Waste Hub Wallet</span>
            </div>

            {/* Progress to next milestone */}
            {nextMilestone ? (
              <div>
                <div className="flex justify-between text-xs text-white/70 mb-1.5">
                  <span>{points.toLocaleString()} coins</span>
                  <span>{nextMilestone.threshold.toLocaleString()} coins</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/80 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-white/70 mt-1.5">
                  {nextMilestone.pointsNeeded.toLocaleString()} coins to next milestone · {nextMilestone.rewardType.replace(/_/g, " ")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-white/80">🎉 All milestones reached! You're at the top!</p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <Coins className="w-6 h-6 text-primary mx-auto mb-1.5" />
            <p className="text-xl font-bold text-foreground">{points.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Coins</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <Award className="w-6 h-6 text-yellow-500 mx-auto mb-1.5" />
            <p className="text-xl font-bold text-foreground">{badges.length}</p>
            <p className="text-xs text-muted-foreground">Badges</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1.5" />
            <p className="text-xl font-bold text-foreground">{streak}</p>
            <p className="text-xs text-muted-foreground">Streak</p>
          </div>
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
                        {item.collectionId && (
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {item.collectionId}</p>
                        )}
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

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["overview", "history", "badges"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview" && "Overview"}
              {tab === "history" && `History (${history.length})`}
              {tab === "badges" && `Badges (${badges.length}/${ALL_BADGES.length})`}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Tier Benefits */}
            <div className={`rounded-xl border ${tierCfg.border} ${tierCfg.bg} p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <TierIcon className={`w-5 h-5 ${tierCfg.text}`} />
                <h3 className={`font-semibold ${tierCfg.text}`}>{tier} Tier Benefits</h3>
              </div>
              <ul className="space-y-2">
                {tierCfg.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ChevronRight className={`w-4 h-4 ${tierCfg.text}`} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Milestone Progress */}
            <div>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Milestone Progress
              </h3>
              <div className="space-y-4">
                {milestones.map((ms) => {
                  const pct = Math.min(100, Math.round((points / ms.threshold) * 100));
                  return (
                    <div key={ms.threshold} className={`p-4 rounded-xl border ${ms.reached ? "border-green-300 bg-green-50" : "border-border bg-card"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Gift className={`w-4 h-4 ${ms.reached ? "text-green-600" : "text-muted-foreground"}`} />
                          <span className={`text-sm font-medium ${ms.reached ? "text-green-700" : "text-foreground"}`}>
                            {ms.threshold.toLocaleString()} coins — {ms.rewardType.replace(/_/g, " ")}
                          </span>
                        </div>
                        {ms.reached ? (
                          <span className="text-xs font-semibold text-green-600 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                            ✓ Reached
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        )}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${ms.reached ? "bg-green-500" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* How to earn */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" />
                How to Earn Coins
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: "⚖️", label: "1 coin per kg", desc: "Submit items by weight" },
                  { icon: "📦", label: "5 coins per piece", desc: "Submit items by pieces" },
                  { icon: "🔥", label: "Streak bonus", desc: "Contribute regularly" },
                  { icon: "✅", label: "Completion bonus", desc: "Items fully processed" },
                ].map((tip) => (
                  <div key={tip.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="text-xl">{tip.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tip.label}</p>
                      <p className="text-xs text-muted-foreground">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div>
            {history.length === 0 ? (
              <div className="py-16 text-center">
                <Coins className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No transactions yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Submit e-waste to start earning coins</p>
                <Link to="/dashboard/small-user">
                  <Button className="gap-2">
                    <Recycle className="w-4 h-4" />
                    Submit E-Waste
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Recycle className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {h.category ? `${h.category}` : h.action.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {h.quantity && h.unit ? `${h.quantity} ${h.unit} · ` : ""}
                          {new Date(h.timestamp).toLocaleString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary font-bold">
                      <Coins className="w-4 h-4" />
                      <span>+{h.points}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === "badges" && (
          <div className="grid sm:grid-cols-2 gap-4">
            {ALL_BADGES.map((b) => {
              const earned = badges.find((earned) => earned.name === b.name);
              const pct = Math.min(100, Math.round((points / b.threshold) * 100));
              return (
                <div
                  key={b.name}
                  className={`p-5 rounded-xl border transition-all ${
                    earned
                      ? "border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50"
                      : "border-border bg-card opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{BADGE_ICONS[b.name] ?? "🏅"}</div>
                    {earned ? (
                      <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full">
                        Earned
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        Locked
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-foreground mb-1">{b.name}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {earned
                      ? `Earned on ${new Date(earned.earnedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                      : `Requires ${b.threshold.toLocaleString()} coins`}
                  </p>
                  {!earned && (
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
