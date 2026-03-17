import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Award,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogOut,
  Upload,
  X,
  ImageIcon,
  MapPin,
  Loader2,
  Coins,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const CATEGORIES = [
  "Old Laptops",
  "Mobile Phones",
  "Electronic Cables",
  "Monitors",
  "Batteries",
  "Circuit Boards",
  "Printers",
  "Keyboards & Mouse",
  "Other",
];

const CONDITIONS = [
  "Working",
  "Not Working",
  "Damaged",
  "For Parts",
  "Other",
];

const UNITS = ["pieces", "kg"];

export default function SmallUserDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [intents, setIntents] = useState([]);
  const [rewardData, setRewardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const defaultFormItem = () => ({
    category: CATEGORIES[0],
    categoryOtherText: "",
    condition: CONDITIONS[0],
    conditionOtherText: "",
    estimatedQty: 1,
    unit: "pieces",
    photos: [],
    purchaseDate: "",
  });

  const [formItems, setFormItems] = useState([defaultFormItem()]);
  const [address, setAddress] = useState("");

  const apiFetch = useCallback(
    async (url, options) => {
      return fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options?.headers,
        },
      });
    },
    [token]
  );

  const fetchIntents = useCallback(async () => {
    try {
      const res = await apiFetch("/api/intent");
      if (res.ok) {
        const data = await res.json();
        setIntents(data.intents || []);
      }
    } catch (err) {
      console.error("Failed to fetch intents:", err);
    }
  }, [apiFetch]);

  const fetchRewards = useCallback(async () => {
    try {
      const res = await apiFetch("/api/intent/rewards");
      if (res.ok) {
        const data = await res.json();
        setRewardData(data);
      }
    } catch (err) {
      console.error("Failed to fetch rewards:", err);
    }
  }, [apiFetch]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchIntents(), fetchRewards()]);
      setLoading(false);
    };
    load();

    // Poll every 30 s so status changes (e.g. collector accepts) appear automatically
    const interval = setInterval(() => {
      fetchIntents();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchIntents, fetchRewards]);

  const handleImageUpload = (itemIdx, e) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be under 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormItems((prev) => {
          const updated = [...prev];
          updated[itemIdx] = {
            ...updated[itemIdx],
            photos: [...updated[itemIdx].photos, reader.result],
          };
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = (itemIdx, photoIdx) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[itemIdx] = {
        ...updated[itemIdx],
        photos: updated[itemIdx].photos.filter((_, i) => i !== photoIdx),
      };
      return updated;
    });
  };

  const addFormItem = () => {
    setFormItems((prev) => [...prev, defaultFormItem()]);
  };

  const removeFormItem = (idx) => {
    if (formItems.length <= 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateFormItem = (idx, field, value) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleSubmitIntent = async () => {
    const invalid = formItems.some(
      (item) =>
        !item.category ||
        item.estimatedQty < 1 ||
        (item.category === "Other" && !item.categoryOtherText?.trim()) ||
        (item.condition === "Other" && !item.conditionOtherText?.trim())
    );
    if (invalid) {
      alert("Please fill in all item details. If you chose Other for category or condition, enter the specified value.");
      return;
    }

    const payloadItems = formItems.map((item) => ({
      category: item.category === "Other" ? item.categoryOtherText.trim() : item.category,
      categoryOtherText: item.category === "Other" ? item.categoryOtherText.trim() : undefined,
      condition: item.condition === "Other" ? item.conditionOtherText.trim() : item.condition,
      conditionOtherText: item.condition === "Other" ? item.conditionOtherText.trim() : undefined,
      estimatedQty: item.estimatedQty,
      unit: item.unit,
      photos: item.photos,
      purchaseDate: item.purchaseDate || undefined,
    }));

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/intent", {
        method: "POST",
        body: JSON.stringify({
          items: payloadItems,
          location: { lat: 0, lng: 0, address: address || "Not specified" },
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        setFormItems([defaultFormItem()]);
        setAddress("");
        await fetchIntents();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit");
      }
    } catch {
      alert("Failed to submit intent");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const statusConfig = {
    submitted: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock, label: "Submitted" },
    assigned: { color: "bg-purple-50 text-purple-700 border-purple-200", icon: AlertCircle, label: "Collector Assigned" },
    collected: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2, label: "Collected" },
    cancelled: { color: "bg-red-50 text-red-700 border-red-200", icon: Trash2, label: "Cancelled" },
  };

  const points = rewardData?.totalPoints ?? 0;
  const badges = rewardData?.badges ?? [];
  const milestones = rewardData?.milestones ?? [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                  <Package className="w-5 h-5" />
                </div>
                <span className="font-bold text-foreground">E-Waste Hub</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/reward">
                <Button variant="outline" size="sm" className="gap-2 border-primary/40 text-primary hover:bg-primary/5">
                  <Coins className="w-4 h-4" />
                  <span className="hidden sm:inline">{Math.round(points)} Coins</span>
                  <span className="sm:hidden">Wallet</span>
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground hidden lg:block">{user?.name}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <section className="mb-10">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {user?.name}!</h1>
            <p className="text-muted-foreground">Help manage e-waste responsibly and earn rewards for your contribution</p>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Points</p>
                <p className="text-2xl font-bold text-foreground">{Math.round(points)}</p>
              </div>
              <div className="p-3 rounded-lg bg-accent/10">
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
            </div>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Items Submitted</p>
                <p className="text-2xl font-bold text-foreground">{intents.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Collected</p>
                <p className="text-2xl font-bold text-foreground">
                  {intents.filter((i) => i.status === "collected").length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Badges</p>
                <p className="text-2xl font-bold text-foreground">{badges.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-100">
                <Award className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Intents List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">My E-Waste Submissions</h2>
              <Button className="gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                New Submission
              </Button>
            </div>

            {intents.length === 0 ? (
              <div className="p-12 rounded-lg border border-dashed border-border text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No submissions yet</h3>
                <p className="text-muted-foreground mb-4">Submit your first e-waste disposal request</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit E-Waste
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {intents.map((intent) => {
                  const cfg = statusConfig[intent.status] || statusConfig.submitted;
                  const StatusIcon = cfg.icon;
                  const isAssigned = intent.status === "assigned";
                  const isCollected = intent.status === "collected";
                  return (
                    <div
                      key={intent._id}
                      className={`p-6 rounded-lg border bg-card transition-colors ${
                        isAssigned
                          ? "border-purple-300 bg-purple-50/30"
                          : isCollected
                          ? "border-green-300 bg-green-50/30"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {/* Collector accepted banner */}
                      {isAssigned && (
                        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-purple-100 border border-purple-200 text-purple-700 text-sm font-medium">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          A collector has accepted your request and will pick up soon!
                        </div>
                      )}
                      {isCollected && (
                        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-green-100 border border-green-200 text-green-700 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          Your e-waste has been collected!
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {intent.items.map((i) => i.category).join(", ")}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Submitted {new Date(intent.createdAt).toLocaleDateString()}
                            {intent.updatedAt && intent.updatedAt !== intent.createdAt && (
                              <> · Updated {new Date(intent.updatedAt).toLocaleString()}</>
                            )}
                          </p>
                        </div>
                        <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 text-sm">
                        {intent.items.map((item, idx) => (
                          <div key={idx}>
                            <p className="text-muted-foreground">{item.category}</p>
                            <p className="font-semibold text-foreground">
                              {item.estimatedQty} {item.unit}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Image thumbnails */}
                      {intent.items.some((i) => i.photos.length > 0) && (
                        <div className="flex gap-2 flex-wrap mb-3">
                          {intent.items.flatMap((item) =>
                            item.photos.map((photo, pIdx) => (
                              <img
                                key={`${item.category}-${pIdx}`}
                                src={photo}
                                alt={item.category}
                                className="w-16 h-16 object-cover rounded-lg border border-border"
                              />
                            ))
                          )}
                        </div>
                      )}

                      {intent.location?.address && intent.location.address !== "Not specified" && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5" />
                          {intent.location.address}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rewards Sidebar */}
          <aside>
            {/* Wallet shortcut */}
            <Link to="/reward" className="block mb-6">
              <div className="p-5 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-center hover:opacity-90 transition-opacity">
                <Coins className="w-8 h-8 mx-auto mb-2 opacity-90" />
                <p className="text-3xl font-bold">{Math.round(points)}</p>
                <p className="text-sm opacity-80">coins earned</p>
                <p className="mt-2 text-xs bg-white/20 rounded-full px-3 py-1 inline-block">View Full Wallet →</p>
              </div>
            </Link>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-accent" />
                Your Badges
              </h3>
              {badges.length === 0 ? (
                <p className="text-sm text-muted-foreground">No badges yet. Keep contributing!</p>
              ) : (
                <div className="space-y-3">
                  {badges.map((badge, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-accent/20 bg-accent/5 text-center">
                      <p className="font-semibold text-foreground text-sm">{badge.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Milestone Progress</h3>
              <div className="space-y-4">
                {milestones.map((milestone, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground">{milestone.threshold} Points</p>
                      {milestone.reached && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 capitalize">
                      Reward: {milestone.rewardType.replace("_", " ")}
                    </p>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: milestone.reached ? "100%" : `${Math.min((points / milestone.threshold) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <h4 className="font-semibold text-foreground mb-3 text-sm">How to earn more points</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span>Submit items with clear photos</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span>Ensure collectors can verify easily</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">3.</span>
                  <span>Complete items through the full lifecycle</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {/* New Submission Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Submit E-Waste for Disposal</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {formItems.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-border bg-card/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-foreground">Item {idx + 1}</h4>
                  {formItems.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeFormItem(idx)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                    <select
                      value={item.category}
                      onChange={(e) => updateFormItem(idx, "category", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.estimatedQty}
                      onChange={(e) => updateFormItem(idx, "estimatedQty", parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Unit</label>
                    <select
                      value={item.unit}
                      onChange={(e) => updateFormItem(idx, "unit", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {item.category === "Other" && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-foreground mb-1">Specify category</label>
                    <input
                      type="text"
                      value={item.categoryOtherText}
                      onChange={(e) => updateFormItem(idx, "categoryOtherText", e.target.value)}
                      placeholder="Enter category"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Condition</label>
                    <select
                      value={item.condition}
                      onChange={(e) => updateFormItem(idx, "condition", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {item.condition === "Other" && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Specify condition</label>
                      <input
                        type="text"
                        value={item.conditionOtherText}
                        onChange={(e) => updateFormItem(idx, "conditionOtherText", e.target.value)}
                        placeholder="Enter condition"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  )}
                  <div className={item.condition === "Other" ? "sm:col-span-2" : ""}>
                    <label className="block text-sm font-medium text-foreground mb-1">Invoice / Purchase Date</label>
                    <input
                      type="date"
                      value={item.purchaseDate}
                      onChange={(e) => updateFormItem(idx, "purchaseDate", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Photos</label>
                  <div className="flex flex-wrap gap-3">
                    {item.photos.map((photo, pIdx) => (
                      <div key={pIdx} className="relative group">
                        <img
                          src={photo}
                          alt={`${item.category} ${pIdx + 1}`}
                          className="w-20 h-20 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(idx, pIdx)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleImageUpload(idx, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addFormItem} className="w-full gap-2">
              <Plus className="w-4 h-4" />
              Add Another Item
            </Button>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <MapPin className="w-4 h-4 inline mr-1" />
                Pickup Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your pickup address"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <Button onClick={handleSubmitIntent} disabled={submitting} className="w-full gap-2">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit E-Waste Request
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
