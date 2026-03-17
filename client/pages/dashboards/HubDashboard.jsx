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
  Package,
  LogOut,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Shield,
  Loader2,
  ClipboardCheck,
  Boxes,
  Eye,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const CONDITIONS = ["excellent", "good", "fair", "damaged"];

export default function HubDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("incoming");
  const [incomingItems, setIncomingItems] = useState([]);
  const [verifiedItems, setVerifiedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [verifyDialog, setVerifyDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [verifyQty, setVerifyQty] = useState(0);
  const [verifyCondition, setVerifyCondition] = useState("good");
  const [verifyCategory, setVerifyCategory] = useState("");
  const [flagDialog, setFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState("");

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

  const fetchData = useCallback(async () => {
    try {
      const [incRes, invRes] = await Promise.all([
        apiFetch("/api/hub/incoming"),
        apiFetch("/api/hub/inventory"),
      ]);

      if (incRes.ok) {
        const data = await incRes.json();
        setIncomingItems(data.incomingItems || []);
      }
      if (invRes.ok) {
        const data = await invRes.json();
        setVerifiedItems(data.verifiedItems || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  }, [apiFetch]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    load();
  }, [fetchData]);

  const openVerifyDialog = (item) => {
    setSelectedItem(item);
    setVerifyQty(item.actualQty);
    setVerifyCondition(item.condition || "good");
    setVerifyCategory(item.category);
    setVerifyDialog(true);
  };

  const handleVerify = async () => {
    if (!selectedItem) return;
    setActionLoading(selectedItem._id);
    try {
      const res = await apiFetch("/api/hub/verify", {
        method: "POST",
        body: JSON.stringify({
          inventoryId: selectedItem._id,
          actualQty: verifyQty,
          condition: verifyCondition,
          category: verifyCategory,
        }),
      });

      if (res.ok) {
        setVerifyDialog(false);
        setSelectedItem(null);
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to verify");
      }
    } catch {
      alert("Failed to verify item");
    } finally {
      setActionLoading(null);
    }
  };

  const openFlagDialog = (item) => {
    setSelectedItem(item);
    setFlagReason("");
    setFlagDialog(true);
  };

  const handleFlag = async () => {
    if (!selectedItem || !flagReason) return;
    setActionLoading(selectedItem._id);
    try {
      const res = await apiFetch("/api/hub/flag", {
        method: "POST",
        body: JSON.stringify({
          inventoryId: selectedItem._id,
          reason: flagReason,
        }),
      });

      if (res.ok) {
        setFlagDialog(false);
        setSelectedItem(null);
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to flag");
      }
    } catch {
      alert("Failed to flag item");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const statusColorMap = {
    verified: "bg-green-50 text-green-700 border-green-200",
    matched: "bg-purple-50 text-purple-700 border-purple-200",
    in_transit: "bg-blue-50 text-blue-700 border-blue-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processed: "bg-teal-50 text-teal-700 border-teal-200",
  };

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
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:block">{user?.name}</span>
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
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-8">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-7 h-7 text-green-600" />
              <h1 className="text-3xl font-bold text-foreground">Hub Dashboard</h1>
            </div>
            <p className="text-muted-foreground">Verify incoming items, manage inventory, and ensure quality</p>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Incoming</p>
                <p className="text-2xl font-bold text-foreground">{incomingItems.length}</p>
              </div>
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Verified</p>
                <p className="text-2xl font-bold text-foreground">
                  {verifiedItems.filter((i) => i.status === "verified").length}
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Matched</p>
                <p className="text-2xl font-bold text-foreground">
                  {verifiedItems.filter((i) => ["matched", "in_transit", "delivered", "processed"].includes(i.status)).length}
                </p>
              </div>
              <Boxes className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Stock</p>
                <p className="text-2xl font-bold text-foreground">{verifiedItems.length}</p>
              </div>
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {["incoming", "verified"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "incoming" && `Incoming (${incomingItems.length})`}
              {tab === "verified" && `Verified Inventory (${verifiedItems.length})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "incoming" && (
          <div className="space-y-4">
            {incomingItems.length === 0 ? (
              <div className="p-12 rounded-lg border border-dashed border-border text-center">
                <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No incoming items</h3>
                <p className="text-muted-foreground">Waiting for collectors to deliver items</p>
              </div>
            ) : (
              incomingItems.map((item) => (
                <div key={item._id} className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{item.category}</h3>
                      <p className="text-sm text-muted-foreground">QR: {item.qrCode}</p>
                    </div>
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                      Awaiting Verification
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="text-sm font-semibold text-foreground">{item.actualQty} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Condition</p>
                      <p className="text-sm font-semibold text-foreground capitalize">{item.condition || "unknown"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Collector</p>
                      <p className="text-sm font-semibold text-foreground">{item.collectorName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Source User</p>
                      <p className="text-sm font-semibold text-foreground">{item.sourceUserName}</p>
                    </div>
                  </div>

                  {item.verificationPhotos.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-4">
                      {item.verificationPhotos.map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo}
                          alt={`${item.category} photo`}
                          className="w-20 h-20 object-cover rounded-lg border border-border"
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button onClick={() => openVerifyDialog(item)} className="gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Verify Item
                    </Button>
                    <Button variant="outline" onClick={() => openFlagDialog(item)} className="gap-2 text-yellow-700 border-yellow-200 hover:bg-yellow-50">
                      <AlertTriangle className="w-4 h-4" />
                      Flag Issue
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "verified" && (
          <div className="space-y-4">
            {verifiedItems.length === 0 ? (
              <div className="p-12 rounded-lg border border-dashed border-border text-center">
                <Boxes className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No verified inventory</h3>
                <p className="text-muted-foreground">Verify incoming items to build your inventory</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">QR Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Condition</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {verifiedItems.map((item) => (
                      <tr key={item._id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{item.category}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{item.qrCode.slice(0, 15)}...</td>
                        <td className="px-4 py-3 text-sm text-foreground">{item.actualQty} {item.unit}</td>
                        <td className="px-4 py-3 text-sm text-foreground capitalize">{item.condition}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${
                            statusColorMap[item.status] || "bg-gray-50 text-gray-700 border-gray-200"
                          }`}>
                            {item.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{item.sourceUserName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Verify Dialog */}
      <Dialog open={verifyDialog} onOpenChange={setVerifyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-green-600" />
              Verify Item
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-5 py-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Item</p>
                <p className="font-semibold text-foreground">{selectedItem.category}</p>
                <p className="text-xs text-muted-foreground mt-1">QR: {selectedItem.qrCode}</p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Actual Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={verifyQty}
                    onChange={(e) => setVerifyQty(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Condition</label>
                  <select
                    value={verifyCondition}
                    onChange={(e) => setVerifyCondition(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                  <input
                    type="text"
                    value={verifyCategory}
                    onChange={(e) => setVerifyCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <Button
                onClick={handleVerify}
                disabled={actionLoading === selectedItem._id}
                className="w-full gap-2"
              >
                {actionLoading === selectedItem._id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirm Verification
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog open={flagDialog} onOpenChange={setFlagDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Flag Discrepancy
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-5 py-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Item</p>
                <p className="font-semibold text-foreground">{selectedItem.category} — {selectedItem.actualQty} {selectedItem.unit}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Reason for Flag</label>
                <textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  rows={3}
                  placeholder="Describe the discrepancy..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                />
              </div>

              <Button
                onClick={handleFlag}
                disabled={!flagReason || actionLoading === selectedItem._id}
                className="w-full gap-2"
                variant="outline"
              >
                {actionLoading === selectedItem._id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                Submit Flag
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
