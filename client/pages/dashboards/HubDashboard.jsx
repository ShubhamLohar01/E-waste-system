import { useState, useEffect, useCallback, Fragment } from "react";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import NotificationsBell from "@/components/NotificationsBell";
import BoxStickerSheet from "@/components/BoxStickerSheet";
import RaiseDisputeDialog from "@/components/RaiseDisputeDialog";

const CONDITIONS = ["excellent", "good", "fair", "damaged"];

export default function HubDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("incoming");
  const [incomingItems, setIncomingItems] = useState([]);
  const [verifiedItems, setVerifiedItems] = useState([]);
  const [earnings, setEarnings] = useState({ balanceRs: 0, entries: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [verifyDialog, setVerifyDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [verifyQty, setVerifyQty] = useState(0);
  const [verifyWeight, setVerifyWeight] = useState("");
  const [verifyCondition, setVerifyCondition] = useState("good");
  const [verifyCategory, setVerifyCategory] = useState("");
  const [staged, setStaged] = useState(null);     // prepare response: { boxes, transactionNo, item } -> drives the inline print panel
  const [printed, setPrinted] = useState(false);  // hub clicked "Print all" for the staged boxes
  const [verifyBoxCount, setVerifyBoxCount] = useState(1);
  const [expandedId, setExpandedId] = useState(null); // verified-inventory row expanded
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

      try {
        const res = await apiFetch("/api/earnings/mine");
        if (res.ok) setEarnings(await res.json());
      } catch { /* ignore */ }
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

  const handleReceive = async (item) => {
    setActionLoading("receive-" + item._id);
    try {
      const res = await apiFetch("/api/hub/receive", {
        method: "POST",
        body: JSON.stringify({ inventoryIds: [item._id] }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to receive items");
      }
    } catch {
      alert("Failed to receive items");
    } finally {
      setActionLoading(null);
    }
  };

  const openVerifyDialog = (item) => {
    setSelectedItem(item);
    setVerifyQty(item.actualQty);
    setVerifyWeight(item.weightKg != null ? String(item.weightKg) : "");
    setVerifyCondition(item.condition || "good");
    setVerifyCategory(item.category);
    setStaged(null);
    setPrinted(false);
    setVerifyBoxCount(item.pendingBoxCount > 0 ? item.pendingBoxCount : 1);
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
          weightKg: verifyWeight === "" ? null : Number(verifyWeight),
          condition: verifyCondition,
          category: verifyCategory,
          boxCount: verifyBoxCount,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStaged(data);
        setPrinted(false);
        setVerifyDialog(false); // close the form; the inline print panel takes over
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

  const handleConfirmPrint = useCallback(async () => {
    if (!staged?.item?._id) return;
    try {
      const res = await apiFetch("/api/hub/confirm-print", {
        method: "POST",
        body: JSON.stringify({ inventoryId: staged.item._id }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to verify");
        return;
      }
      setStaged(null);
      setPrinted(false);
      await fetchData();
    } catch {
      alert("Failed to verify");
    }
  }, [apiFetch, staged, fetchData]);

  // Dismiss the staged panel without verifying; the boxes stay pending_print and
  // the item remains resumable from the incoming list ("Finish printing").
  const discardStaged = () => {
    setStaged(null);
    setPrinted(false);
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

  const recordCollectorPayment = async (inventoryId) => {
    const raw = window.prompt("Amount to pay the collector for this item (₹):");
    if (raw == null) return;
    const amountRs = Number(raw);
    if (!Number.isFinite(amountRs) || amountRs <= 0) return alert("Enter a positive amount.");
    try {
      const res = await apiFetch("/api/hub/collector-payment", {
        method: "POST",
        body: JSON.stringify({ inventoryId, amountRs }),
      });
      if (!res.ok) { const d = await res.json(); return alert(d.error || "Failed."); }
      alert("Collector payment recorded.");
      await fetchData();
    } catch { alert("Failed to record payment."); }
  };

  const handleLogout = async () => {
    await logout();
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
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-medium" title="Your earnings">
                ₹{Math.round(earnings.balanceRs)}
              </span>
              <NotificationsBell />
              <Link to="/profile">
                <Button variant="outline" size="sm" className="hidden sm:inline-flex">Profile</Button>
              </Link>
              <span className="text-sm text-muted-foreground hidden md:inline">{user?.name}</span>
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
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      item.status === "at_hub"
                        ? "bg-orange-50 text-orange-700 border-orange-200"
                        : item.status === "pending_print"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200"
                    }`}>
                      {item.status === "at_hub"
                        ? "Pending receipt"
                        : item.status === "pending_print"
                          ? "Printing"
                          : "Awaiting Verification"}
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

                  <div className="flex gap-3 flex-wrap">
                    {item.status === "at_hub" ? (
                      <Button
                        onClick={() => handleReceive(item)}
                        disabled={actionLoading === "receive-" + item._id}
                        className="gap-2"
                      >
                        {actionLoading === "receive-" + item._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ClipboardCheck className="w-4 h-4" />
                        )}
                        Receive
                      </Button>
                    ) : item.status === "pending_print" ? (
                      <Button onClick={() => openVerifyDialog(item)} className="gap-2 bg-amber-600 hover:bg-amber-700">
                        <Clock className="w-4 h-4" />
                        Finish printing
                      </Button>
                    ) : (
                      <Button onClick={() => openVerifyDialog(item)} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Verify Item
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => openFlagDialog(item)} className="gap-2 text-yellow-700 border-yellow-200 hover:bg-yellow-50">
                      <AlertTriangle className="w-4 h-4" />
                      Flag Issue
                    </Button>
                    <RaiseDisputeDialog
                      relatedInventoryId={item._id}
                      againstUserId={item.collectorId}
                      triggerLabel="Dispute w/ collector"
                    />
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
                    {verifiedItems.map((item) => {
                      const isOpen = expandedId === item._id;
                      return (
                        <Fragment key={item._id}>
                          <tr
                            className="hover:bg-muted/20 cursor-pointer"
                            onClick={() => setExpandedId(isOpen ? null : item._id)}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-foreground">
                              <span className="inline-flex items-center gap-2">
                                {isOpen ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                                {item.category}
                              </span>
                            </td>
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
                          {isOpen && (
                            <tr className="bg-muted/10">
                              <td colSpan={6} className="px-4 py-4">
                                <div className="grid gap-6 lg:grid-cols-3">
                                  {/* Details */}
                                  <div className="space-y-1 text-sm">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Details</p>
                                    <p><span className="text-muted-foreground">QR:</span> <span className="font-mono break-all">{item.qrCode}</span></p>
                                    <p><span className="text-muted-foreground">Weight:</span> {item.weightKg != null ? `${item.weightKg} kg` : "—"}</p>
                                    <p><span className="text-muted-foreground">Condition:</span> <span className="capitalize">{item.condition || "—"}</span></p>
                                    <p><span className="text-muted-foreground">Source:</span> {item.sourceUserName || "—"}</p>
                                    <p><span className="text-muted-foreground">Recycler:</span> {item.recyclerCode || "—"}</p>
                                    <p><span className="text-muted-foreground">Verified:</span> {item.hubVerifiedAt ? new Date(item.hubVerifiedAt).toLocaleString() : "—"}</p>
                                  </div>

                                  {/* Boxes */}
                                  <div className="text-sm">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                      Boxes{item.boxes?.length ? ` (${item.boxes.length})` : ""}
                                    </p>
                                    {item.boxes?.length ? (
                                      <>
                                        <p className="text-[11px] text-muted-foreground font-mono mb-1">{item.boxes[0].transactionNo}</p>
                                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                          {item.boxes.map((b) => (
                                            <div key={b.boxId} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
                                              <span className="font-mono text-xs font-semibold">{b.boxId}</span>
                                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                                {b.netWeightKg != null ? `${b.netWeightKg} kg · ` : ""}Box {b.boxSeq}/{b.boxCount}
                                              </span>
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize whitespace-nowrap ${
                                                b.status === "acknowledged" ? "bg-green-50 text-green-700 border-green-200"
                                                : b.status === "printed" ? "bg-blue-50 text-blue-700 border-blue-200"
                                                : "bg-amber-50 text-amber-700 border-amber-200"
                                              }`}>{b.status.replace("_", " ")}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </>
                                    ) : (
                                      <p className="text-muted-foreground text-xs">No boxes (verified before box tracking).</p>
                                    )}
                                  </div>

                                  {/* Chain of custody */}
                                  <div className="text-sm">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Chain of custody</p>
                                    {item.traceability?.length ? (
                                      <ol className="space-y-1.5">
                                        {item.traceability.map((t, idx) => (
                                          <li key={idx} className="flex gap-2">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                            <span className="text-xs">
                                              <span className="capitalize font-medium">{(t.action || "").replace(/_/g, " ")}</span>
                                              {t.actorName ? ` · ${t.actorName}` : ""}
                                              {t.timestamp ? (
                                                <span className="block text-[10px] text-muted-foreground">{new Date(t.timestamp).toLocaleString()}</span>
                                              ) : null}
                                            </span>
                                          </li>
                                        ))}
                                      </ol>
                                    ) : (
                                      <p className="text-muted-foreground text-xs">No history.</p>
                                    )}
                                  </div>
                                </div>
                                {item.collectorId && (
                                  <div className="mt-4 pt-4 border-t border-border">
                                    <Button size="sm" variant="outline" onClick={() => recordCollectorPayment(item._id)}>
                                      Record collector payment
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Staged boxes — print, then verify (moves the item to Verified Inventory).
            Placed below the entry lists so it appears under the item just verified. */}
        {staged && (
          <section className="mt-8 rounded-lg border-2 border-amber-300 bg-amber-50/60 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Print &amp; verify — {staged.item?.category}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {(staged.boxes || []).length} box{(staged.boxes || []).length > 1 ? "es" : ""} · Txn {staged.transactionNo}.
                  Print the QR stickers first, then verify to move this item to Verified Inventory.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={discardStaged} className="text-muted-foreground">
                Cancel
              </Button>
            </div>

            <BoxStickerSheet boxes={staged.boxes || []} onPrint={() => setPrinted(true)} />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleConfirmPrint}
                disabled={!printed}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                Verify &amp; move to inventory
              </Button>
              {!printed && (
                <span className="text-xs text-amber-700">Print the QR stickers to enable verification.</span>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Verify Dialog */}
      <Dialog
        open={verifyDialog}
        onOpenChange={(open) => {
          setVerifyDialog(open);
          if (!open) setSelectedItem(null);
        }}
      >
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

              <div className="grid sm:grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-foreground mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={verifyWeight}
                    onChange={(e) => setVerifyWeight(e.target.value)}
                    placeholder="e.g. 4.5"
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
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Number of boxes</label>
                  <input
                    type="number"
                    min="1"
                    value={verifyBoxCount}
                    onChange={(e) => setVerifyBoxCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {selectedItem.status === "pending_print" && (
                  <p className="text-xs text-amber-700">
                    {verifyBoxCount} box{verifyBoxCount > 1 ? "es" : ""} already staged — submit to preview &amp; print them.
                  </p>
                )}
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
                  Submit
                </Button>
              </div>
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
