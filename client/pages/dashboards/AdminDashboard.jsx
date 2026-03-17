import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Package,
  LogOut,
  Settings,
  Users,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Shield,
} from "lucide-react";

export default function AdminDashboard() {
  const metrics = [
    { label: "Total Inventory Items", value: "12,847", icon: Package, change: "+5.2%" },
    { label: "Active Users", value: "3,256", icon: Users, change: "+2.1%" },
    { label: "Supply-Demand Match Rate", value: "94.3%", icon: TrendingUp, change: "+1.8%" },
    { label: "System Throughput (kg/day)", value: "24,500", icon: BarChart3, change: "+8.5%" },
  ];

  const recentDisputes = [
    { id: "DSP-001", type: "Quantity Mismatch", status: "investigating", severity: "high" },
    { id: "DSP-002", type: "Quality Discrepancy", status: "open", severity: "medium" },
    { id: "DSP-003", type: "Missing Items", status: "investigating", severity: "high" },
  ];

  const adminTools = [
    { title: "User Management", description: "Manage roles, trust levels, and permissions", icon: Users },
    { title: "System Configuration", description: "Set matching thresholds and parameters", icon: Settings },
    { title: "Dispute Resolution", description: "Review and resolve conflicts", icon: AlertTriangle },
    { title: "Audit Logs", description: "Traceability and compliance tracking", icon: BarChart3 },
    { title: "Reward Management", description: "Configure reward rates and milestones", icon: TrendingUp },
    { title: "Security & Compliance", description: "Monitor system health and alerts", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <span className="font-bold text-foreground">E-Waste Hub</span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Admin</span>
              <Button variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Admin Control Center</h1>
          <p className="text-muted-foreground">System-wide monitoring, governance, and configuration</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                <p className="text-xs text-primary font-medium">{metric.change} this month</p>
              </div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Admin Tools */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-foreground mb-4">Administration Tools</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {adminTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div key={tool.title} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-start gap-3 mb-3">
                      <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <h3 className="font-medium text-foreground">{tool.title}</h3>
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Access</Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Disputes */}
          <aside>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Recent Disputes
            </h3>
            <div className="space-y-3">
              {recentDisputes.map((dispute) => (
                <div key={dispute.id} className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium text-foreground text-sm">{dispute.id}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      dispute.severity === 'high' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                    }`}>
                      {dispute.severity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{dispute.type}</p>
                  <Button variant="outline" size="sm">Review</Button>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* System Health */}
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">System Health</h2>
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">API Health</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-foreground">Operational</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Database</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-foreground">Connected & Healthy</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Last System Check</p>
                <p className="text-sm font-medium text-foreground">5 mins ago</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
