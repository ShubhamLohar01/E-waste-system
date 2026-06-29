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
  Truck,
  MapPin,
  User,
  Phone,
  QrCode,
  Loader2,
  Building2,
  ArrowRight,
  Camera,
  ImagePlus,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import NotificationsBell from "@/components/NotificationsBell";
import RaiseDisputeDialog from "@/components/RaiseDisputeDialog";
import GoogleMapDirections from "@/components/GoogleMapDirections";
import CollectorLocationCard from "@/components/CollectorLocationCard";
import CameraCapture from "@/components/CameraCapture";
import { Navigation, ChevronDown, ChevronUp, ExternalLink, Mail } from "lucide-react";
import { api } from "@/lib/api";

export default function LocalCollectorDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingIntents, setPendingIntents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [earnings, setEarnings] = useState({ balanceRs: 0, entries: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [deliveryDialog, setDeliveryDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedHub, setSelectedHub] = useState("");
  const [selectedIntentId, setSelectedIntentId] = useState("");
  /** Photo (data URL) per assignment - required before marking as collected */
  const [photoByAssignment, setPhotoByAssignment] = useState({});
  /** Per-assignment toggle for the directions panel */
  const [showDirections, setShowDirections] = useState({});
  /** Per-hub toggle for the Hubs tab directions */
  const [showHubDirections, setShowHubDirections] = useState({});
  /** Which assignment (if any) has the in-app camera open */
  const [cameraForAssignment, setCameraForAssignment] = useState(null);

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
      const [pendingRes, assignRes, hubRes] = await Promise.all([
        apiFetch("/api/collector/pending"),
        apiFetch("/api/collector/assignments"),
        apiFetch("/api/collector/hubs"),
      ]);

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingIntents(data.intents || []);
      }
      if (assignRes.ok) {
        const data = await assignRes.json();
        setAssignments(data.assignments || []);
      }
      if (hubRes.ok) {
        const data = await hubRes.json();
        setHubs(data.hubs || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  }, [apiFetch]);

  const fetchEarnings = useCallback(async () => {
    try { const res = await api.get("/api/earnings/mine"); setEarnings(res || { balanceRs: 0, entries: [] }); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchData(), fetchEarnings()]);
      setLoading(false);
    };
    load();
  }, [fetchData, fetchEarnings]);

  const handleAccept = async (intentId) => {
    setActionLoading(intentId);
    try {
      const res = await apiFetch("/api/collector/accept", {
        method: "POST",
        body: JSON.stringify({ intentId }),
      });
      if (res.ok) {
        await fetchData();
        setActiveTab("assigned");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to accept request");
      }
    } catch {
      alert("Failed to accept request");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePhotoChange = (assignmentId, e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select an image file (e.g. photo of the items)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setPhotoByAssignment((prev) => ({ ...prev, [assignmentId]: dataUrl }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCollect = async (assignment) => {
    const photo = photoByAssignment[assignment._id];
    if (!photo) {
      alert("Please take or upload a photo of the item(s) first, then mark as collected.");
      return;
    }

    setActionLoading(assignment._id);
    try {
      const res = await apiFetch("/api/collector/collect", {
        method: "POST",
        body: JSON.stringify({
          intentId: assignment._id,
          items: assignment.items.map((item) => ({ category: item.category })),
          photo,
        }),
      });

      if (res.ok) {
        setPhotoByAssignment((prev) => {
          const next = { ...prev };
          delete next[assignment._id];
          return next;
        });
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to collect");
      }
    } catch {
      alert("Failed to collect items");
    } finally {
      setActionLoading(null);
    }
  };

  const openDeliveryDialog = (assignment) => {
    const collectedItems = assignment.inventoryItems.filter((i) => i.status === "collected");
    setSelectedItems(collectedItems);
    setSelectedIntentId(assignment._id);
    setSelectedHub(hubs[0]?._id || "");
    setDeliveryDialog(true);
  };

  const handleDeliverToHub = async () => {
    if (!selectedHub || selectedItems.length === 0) {
      alert("Please select a hub");
      return;
    }

    setActionLoading("delivery");
    try {
      const res = await apiFetch("/api/collector/hub-delivery", {
        method: "POST",
        body: JSON.stringify({
          intentId: selectedIntentId,
          hubId: selectedHub,
          itemIds: selectedItems.map((i) => i._id),
        }),
      });

      if (res.ok) {
        setDeliveryDialog(false);
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to deliver");
      }
    } catch {
      alert("Failed to deliver to hub");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const assignedIntents = assignments.filter((a) => a.status === "assigned");
  const collectedIntents = assignments.filter(
    (a) => a.status === "collected" && a.inventoryItems.some((i) => i.status === "collected")
  );
  const allCollectedItems = assignments.flatMap((a) => a.inventoryItems).filter(
    (i) => ["at_hub", "verified", "matched", "in_transit", "delivered", "processed"].includes(i.status)
  );

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
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Collector Dashboard</h1>
            <p className="text-muted-foreground">Manage pickups, tag items, and deliver to hubs</p>
          </div>
        </section>

        {/* Live location — keeps the collector matchable to nearby small users */}
        <section className="mb-10">
          <CollectorLocationCard />
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="p-5 rounded-lg border border-primary/30 bg-primary/5">
            <p className="text-sm text-muted-foreground mb-1">New Requests</p>
            <p className="text-2xl font-bold text-primary">{pendingIntents.length}</p>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground mb-1">My Pending Pickups</p>
            <p className="text-2xl font-bold text-foreground">{assignedIntents.length}</p>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground mb-1">Ready for Hub</p>
            <p className="text-2xl font-bold text-foreground">{collectedIntents.length}</p>
          </div>
          <div className="p-5 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground mb-1">Delivered to Hub</p>
            <p className="text-2xl font-bold text-foreground">{allCollectedItems.length}</p>
          </div>
          <div className="p-5 rounded-lg border border-emerald-200 bg-emerald-50/50">
            <p className="text-sm text-muted-foreground mb-1">My earnings</p>
            <p className="text-2xl font-bold text-emerald-700">₹{Math.round(earnings.balanceRs)}</p>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
          {["pending", "assigned", "collected", "hubs", "history"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "pending" && (
                <span className="flex items-center gap-1.5">
                  New Requests
                  {pendingIntents.length > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {pendingIntents.length}
                    </span>
                  )}
                </span>
              )}
              {tab === "assigned" && `My Pickups (${assignedIntents.length})`}
              {tab === "collected" && `Ready for Hub (${collectedIntents.length})`}
              {tab === "hubs" && `Hubs (${hubs.length})`}
              {tab === "history" && "History"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "pending" && (
          <div className="space-y-4">
            {pendingIntents.length === 0 ? (
              <div className="p-12 rounded-lg border border-dashed border-border text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No new requests</h3>
                <p className="text-muted-foreground">New e-waste pickup requests will appear here</p>
              </div>
            ) : (
              pendingIntents.map((intent) => (
                <div key={intent._id} className="p-6 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {intent.items.map((i) => i.category).join(", ")}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Submitted {new Date(intent.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
                        New Request
                      </span>
                      {intent.distanceKm != null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          ~ {intent.distanceKm} km from you
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4 p-4 rounded-lg bg-background">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{intent.userName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{intent.userPhone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm sm:col-span-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">{intent.location?.address || "Address not specified"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {intent.items.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-border bg-background">
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                        <p className="font-semibold text-foreground">{item.estimatedQty} {item.unit}</p>
                        {item.photos.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {item.photos.slice(0, 2).map((photo, pIdx) => (
                              <img key={pIdx} src={photo} alt="" className="w-10 h-10 rounded object-cover border border-border" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleAccept(intent._id)}
                    disabled={actionLoading === intent._id}
                    className="gap-2"
                  >
                    {actionLoading === intent._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Accept Request
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "assigned" && (
          <div className="space-y-4">
            {assignedIntents.length === 0 ? (
              <div className="p-12 rounded-lg border border-dashed border-border text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No pending pickups</h3>
                <p className="text-muted-foreground">Check back later for new assignments</p>
              </div>
            ) : (
              assignedIntents.map((assignment) => (
                <div key={assignment._id} className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {assignment.items.map((i) => i.category).join(", ")}
                      </h3>
                      <p className="text-sm text-muted-foreground">Intent: {assignment._id.slice(0, 12)}...</p>
                    </div>
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      Pending Pickup
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4 p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{assignment.userName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{assignment.userPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm sm:col-span-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">{assignment.location?.address || "Address not specified"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {assignment.items.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-border bg-background">
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                        <p className="font-semibold text-foreground">{item.estimatedQty} {item.unit}</p>
                        {item.photos.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {item.photos.slice(0, 2).map((photo, pIdx) => (
                              <img key={pIdx} src={photo} alt="" className="w-10 h-10 rounded object-cover border border-border" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Step 1: Take/upload photo of items (required before collect) */}
                  <div className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                    <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-600" />
                      Photo of the item(s) — required before marking collected
                    </p>

                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id={`photo-${assignment._id}`}
                      onChange={(e) => handlePhotoChange(assignment._id, e)}
                    />

                    {photoByAssignment[assignment._id] ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <img
                          src={photoByAssignment[assignment._id]}
                          alt="Collection proof"
                          className="w-28 h-28 rounded-lg object-cover border border-border"
                        />
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Photo added
                          </span>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-8"
                              onClick={() => setCameraForAssignment(assignment._id)}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              Retake with camera
                            </Button>
                            <label htmlFor={`photo-${assignment._id}`} className="cursor-pointer">
                              <span className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-border bg-background text-sm hover:bg-muted">
                                <ImagePlus className="w-3.5 h-3.5" />
                                Choose different file
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="gap-2"
                          onClick={() => setCameraForAssignment(assignment._id)}
                        >
                          <Camera className="w-4 h-4" />
                          Open camera
                        </Button>
                        <label htmlFor={`photo-${assignment._id}`}>
                          <span className="inline-flex items-center gap-2 px-4 h-10 rounded-md border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 font-medium cursor-pointer transition-colors">
                            <ImagePlus className="w-4 h-4" />
                            Upload from files
                          </span>
                        </label>
                      </div>
                    )}

                    <p className="mt-2 text-[11px] text-amber-900/70">
                      Tip: on mobile, <strong>Open camera</strong> switches on the rear camera automatically. On desktop,
                      your webcam is used.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleCollect(assignment)}
                      disabled={actionLoading === assignment._id || !photoByAssignment[assignment._id]}
                      className="gap-2"
                    >
                      {actionLoading === assignment._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {photoByAssignment[assignment._id] ? "Mark as Collected" : "Add photo first to mark collected"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        setShowDirections((prev) => ({
                          ...prev,
                          [assignment._id]: !prev[assignment._id],
                        }))
                      }
                    >
                      <Navigation className="w-4 h-4" />
                      {showDirections[assignment._id] ? (
                        <>
                          Hide directions <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          Get directions <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Directions panel: collector's current location → user's pickup */}
                  {showDirections[assignment._id] && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-foreground">Navigate to pickup</p>
                        <p className="text-xs text-muted-foreground">
                          {assignment.location?.address || "Address not specified"}
                        </p>
                      </div>
                      {assignment.location?.lat != null && assignment.location?.lng != null ? (
                        <GoogleMapDirections
                          destination={{
                            lat: assignment.location.lat,
                            lng: assignment.location.lng,
                            address: assignment.location.address,
                          }}
                          originFallback={user?.location}
                        />
                      ) : (
                        <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-900">
                          This pickup has no coordinates recorded — only an address. Please use the address in your own maps app.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "collected" && (
          <div className="space-y-4">
            {collectedIntents.length === 0 ? (
              <div className="p-12 rounded-lg border border-dashed border-border text-center">
                <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No items ready for hub delivery</h3>
                <p className="text-muted-foreground">Collect items first, then deliver them to a hub</p>
              </div>
            ) : (
              collectedIntents.map((assignment) => {
                const collectedItems = assignment.inventoryItems.filter((i) => i.status === "collected");
                return (
                  <div key={assignment._id} className="p-6 rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {assignment.items.map((i) => i.category).join(", ")}
                        </h3>
                        <p className="text-sm text-muted-foreground">From: {assignment.userName}</p>
                      </div>
                      <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <QrCode className="w-3.5 h-3.5 inline mr-1" />
                        Collected ({collectedItems.length} items)
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      {collectedItems.map((item) => (
                        <div key={item._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.category}</p>
                            <p className="text-xs text-muted-foreground">QR: {item.qrCode}</p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{item.actualQty} {item.unit}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => openDeliveryDialog(assignment)} className="gap-2">
                        <Truck className="w-4 h-4" />
                        Deliver to Hub
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                      <RaiseDisputeDialog
                        relatedInventoryId={collectedItems[0]?._id}
                        triggerLabel="Report issue"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "hubs" && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <p className="text-sm text-foreground">
                Hubs sorted by distance from your profile address. Drop collected items at the nearest one — or click
                <strong> Get directions</strong> to see the route.
              </p>
            </div>

            {hubs.length === 0 ? (
              <div className="p-12 rounded-lg border border-dashed border-border text-center">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No hubs configured</h3>
                <p className="text-muted-foreground">Admin will add hubs shortly.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {hubs.map((hub, idx) => {
                  const isNearest = idx === 0;
                  const mapsUrl =
                    hub.lat != null && hub.lng != null
                      ? `https://www.google.com/maps/dir/?api=1&destination=${hub.lat},${hub.lng}&travelmode=driving`
                      : null;
                  return (
                    <div
                      key={hub._id}
                      className={`p-5 rounded-lg border bg-card ${
                        isNearest ? "border-primary/40 bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-foreground">{hub.name}</h3>
                            {isNearest && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                                Nearest
                              </span>
                            )}
                          </div>
                          {hub.distanceKm != null && (
                            <p className="text-xs text-primary font-semibold mt-0.5">
                              ~ {hub.distanceKm} km from you
                            </p>
                          )}
                        </div>
                        <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 mt-1 text-muted-foreground flex-shrink-0" />
                          <p className="text-foreground">{hub.address || "Address not available"}</p>
                        </div>
                        {hub.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <a href={`tel:${hub.phone}`} className="text-foreground hover:underline">
                              {hub.phone}
                            </a>
                          </div>
                        )}
                        {hub.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <a href={`mailto:${hub.email}`} className="text-foreground hover:underline">
                              {hub.email}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            setShowHubDirections((p) => ({ ...p, [hub._id]: !p[hub._id] }))
                          }
                          disabled={hub.lat == null || hub.lng == null}
                        >
                          <Navigation className="w-4 h-4" />
                          {showHubDirections[hub._id] ? (
                            <>
                              Hide directions <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              Get directions <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </Button>
                        {mapsUrl && (
                          <a href={mapsUrl} target="_blank" rel="noreferrer">
                            <Button type="button" size="sm" className="gap-2">
                              <ExternalLink className="w-4 h-4" />
                              Open in Maps
                            </Button>
                          </a>
                        )}
                      </div>

                      {showHubDirections[hub._id] && hub.lat != null && hub.lng != null && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <GoogleMapDirections
                            destination={{ lat: hub.lat, lng: hub.lng, address: hub.address }}
                            originFallback={user?.location}
                            height={240}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {allCollectedItems.length === 0 ? (
              <div className="p-12 rounded-lg border border-dashed border-border text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No history yet</h3>
                <p className="text-muted-foreground">Items you deliver to hubs will appear here</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">QR Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allCollectedItems.map((item) => (
                      <tr key={item._id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{item.category}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{item.qrCode.slice(0, 15)}...</td>
                        <td className="px-4 py-3 text-sm text-foreground">{item.actualQty} {item.unit}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 capitalize">
                            {item.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* In-app camera for collection proof */}
      <CameraCapture
        open={!!cameraForAssignment}
        onClose={() => setCameraForAssignment(null)}
        onCapture={(dataUrl) => {
          setPhotoByAssignment((prev) => ({ ...prev, [cameraForAssignment]: dataUrl }));
          setCameraForAssignment(null);
        }}
        title="Photo of collected e-waste"
      />

      {/* Deliver to Hub Dialog */}
      <Dialog open={deliveryDialog} onOpenChange={setDeliveryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Deliver to Hub</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                Select Hub
              </label>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {hubs.map((hub, idx) => (
                  <option key={hub._id} value={hub._id}>
                    {idx === 0 ? "★ " : ""}{hub.name} — {hub.address}
                    {hub.distanceKm != null ? ` · ${hub.distanceKm} km` : ""}
                  </option>
                ))}
              </select>
              {hubs.length > 0 && (
                <p className="mt-2 text-xs text-primary">
                  ★ Recommended: <span className="font-medium">{hubs[0].name}</span>
                  {hubs[0].distanceKm != null
                    ? ` — ${hubs[0].distanceKm} km away (nearest)`
                    : " (nearest)"}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Items to Deliver ({selectedItems.length})</p>
              <div className="space-y-2">
                {selectedItems.map((item) => (
                  <div key={item._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.category}</p>
                      <p className="text-xs text-muted-foreground">QR: {item.qrCode}</p>
                    </div>
                    <p className="text-sm font-semibold">{item.actualQty} {item.unit}</p>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleDeliverToHub} disabled={actionLoading === "delivery"} className="w-full gap-2">
              {actionLoading === "delivery" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
              Confirm Delivery to Hub
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
