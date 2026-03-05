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
    {
      label: "Total Inventory Items",
      value: "12,847",
      icon: Package,
      change: "+5.2%",
    },
    {
      label: "Active Users",
      value: "3,256",
      icon: Users,
      change: "+2.1%",
    },
    {
      label: "Supply-Demand Match Rate",
      value: "94.3%",
      icon: TrendingUp,
      change: "+1.8%",
    },
    {
      label: "System Throughput (kg/day)",
      value: "24,500",
      icon: BarChart3,
      change: "+8.5%",
    },
  ];

  const recentDisputes = [
    {
      id: "DSP-001",
      type: "Quantity Mismatch",
      status: "investigating",
      severity: "high",
    },
    {
      id: "DSP-002",
      type: "Quality Discrepancy",
      status: "open",
      severity: "medium",
    },
    {
      id: "DSP-003",
      type: "Missing Items",
      status: "investigating",
      severity: "high",
    },
  ];

  const adminTools = [
    {
      title: "User Management",
      description: "Manage roles, trust levels, and user permissions",
      icon: Users,
    },
    {
      title: "System Configuration",
      description: "Set matching thresholds, reward rates, and parameters",
      icon: Settings,
    },
    {
      title: "Dispute Resolution",
      description: "Review and resolve conflicts between actors",
      icon: AlertTriangle,
    },
    {
      title: "Audit Logs",
      description: "Full traceability and system compliance tracking",
      icon: BarChart3,
    },
    {
      title: "Reward Management",
      description: "Configure reward rates, badges, and milestones",
      icon: TrendingUp,
    },
    {
      title: "Security & Compliance",
      description: "Monitor system health and security alerts",
      icon: Shield,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <Package className="w-5 h-5" />
              </div>
              <span className="font-bold text-foreground">E-Waste Hub</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Admin</span>
              <Button variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <section className="mb-12">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Admin Control Center
            </h1>
            <p className="text-muted-foreground">
              System-wide monitoring, governance, and configuration
            </p>
          </div>
        </section>

        {/* Key Metrics */}
        <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <div className="p-3 rounded-lg bg-accent/10">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground mb-2">
                  {metric.value}
                </p>
                <p className="text-xs text-accent font-semibold">
                  {metric.change} this month
                </p>
              </div>
            );
          })}
        </section>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Main - Admin Tools */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Administration Tools
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {adminTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.title}
                    className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 transition-all group cursor-pointer"
                  >
                    <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {tool.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {tool.description}
                    </p>
                    <Button variant="outline" size="sm">
                      Access
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar - Recent Disputes */}
          <aside>
            <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Recent Disputes
            </h3>
            <div className="space-y-4">
              {recentDisputes.map((dispute) => {
                const severityColors: Record<string, string> = {
                  high: "border-destructive/30 bg-destructive/5",
                  medium: "border-yellow-200 bg-yellow-50",
                  low: "border-blue-200 bg-blue-50",
                };
                return (
                  <div
                    key={dispute.id}
                    className={`p-4 rounded-lg border ${severityColors[dispute.severity]}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-foreground text-sm">
                        {dispute.id}
                      </p>
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-white/40">
                        {dispute.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {dispute.type}
                    </p>
                    <Button variant="outline" size="sm">
                      Review
                    </Button>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        {/* System Health */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-6">
            System Health
          </h2>
          <div className="p-8 rounded-lg border border-border bg-card">
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <p className="text-sm text-muted-foreground mb-2">API Health</p>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="font-semibold text-foreground">Operational</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Database</p>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="font-semibold text-foreground">
                    Connected & Healthy
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Last System Check
                </p>
                <p className="font-semibold text-foreground">5 mins ago</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
