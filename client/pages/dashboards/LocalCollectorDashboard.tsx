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

interface InventoryItem {
  _id: string;
  qrCode: string;
  intentId: string;
  category: string;
  actualQty: number;
  unit: string;
  condition: string;
  status: string;
  sourceUserId: string;
  collectorId?: string;
  verificationPhotos: string[];
}

interface Assignment {
  _id: string;
  userId: string;
  items: Array<{ category: string; estimatedQty: number; unit: string; photos: string[] }>;
  status: string;
  location: { lat: number; lng: number; address: string };
  userName: string;
  userPhone: string;
  userAddress: string;
  inventoryItems: InventoryItem[];
  createdAt: string;
}

interface PendingIntent {
  _id: string;
  userId: string;
  items: Array<{ category: string; estimatedQty: number; unit: string; photos: string[] }>;
  status: string;
  location: { lat: number; lng: number; address: string };
  userName: string;
  userPhone: string;
  userAddress: string;
  createdAt: string;
}

interface Hub {
  _id: string;
  name: string;
  address: string;
  phone: string;
}

export default function LocalCollectorDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"pending" | "assigned" | "collected" | "history">("pending");
  const [pendingIntents, setPendingIntents] = useState<PendingIntent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [deliveryDialog, setDeliveryDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [selectedHub, setSelectedHub] = useState("");
  const [selectedIntentId, setSelectedIntentId] = useState("");
  /** Photo (data URL) per assignment - required before marking as collected */
  const [photoByAssignment, setPhotoByAssignment] = useState<Record<string, string>>({});

  const apiFetch = useCallback(
    async (url: string, options?: RequestInit) => {
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    load();
  }, [fetchData]);

  const handleAccept = async (intentId: string) => {
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

  const handlePhotoChange = (assignmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select an image file (e.g. photo of the items)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoByAssignment((prev) => ({ ...prev, [assignmentId]: dataUrl }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCollect = async (assignment: Assignment) => {
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

  const openDeliveryDialog = (assignment: Assignment) => {
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

  const handleLogout = () => {
    logout();
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
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Collector Dashboard</h1>
            <p className="text-muted-foreground">Manage pickups, tag items, and deliver to hubs</p>
          </div>
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
        </section>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
          {(["pending", "assigned", "collected", "history"] as const).map((tab) => (
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
                    <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
                      New Request
                    </span>
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
                    <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-600" />
                      Take or upload a photo of the item(s)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      id={`photo-${assignment._id}`}
                      onChange={(e) => handlePhotoChange(assignment._id, e)}
                    />
                    {photoByAssignment[assignment._id] ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <img
                          src={photoByAssignment[assignment._id]}
                          alt="Collection proof"
                          className="w-24 h-24 rounded-lg object-cover border border-border"
                        />
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Photo added
                          </span>
                          <label htmlFor={`photo-${assignment._id}`} className="cursor-pointer">
                            <span className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                              <ImagePlus className="w-4 h-4" />
                              Change photo
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor={`photo-${assignment._id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 font-medium cursor-pointer transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Click to take photo or upload image
                      </label>
                    )}
                  </div>

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

                    <Button
                      onClick={() => openDeliveryDialog(assignment)}
                      className="gap-2"
                    >
                      <Truck className="w-4 h-4" />
                      Deliver to Hub
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })
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
                {hubs.map((hub) => (
                  <option key={hub._id} value={hub._id}>
                    {hub.name} — {hub.address}
                  </option>
                ))}
              </select>
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
