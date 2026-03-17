import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Package,
  LogOut,
  ArrowRight,
  Zap,
  AlertCircle,
} from "lucide-react";

export default function DashboardPlaceholder({
  roleName,
  roleDescription,
  trustLevel,
  features,
  icon: Icon,
}) {
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
              <span className="text-sm text-muted-foreground">{roleName}</span>
              <Button variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Icon className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{roleName}</h1>
          </div>
          <p className="text-muted-foreground mb-2">{roleDescription}</p>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {trustLevel}
          </span>
        </div>

        {/* Key Features */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Dashboard Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((feature) => (
              <div key={feature} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-start gap-3">
                  <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-foreground">{feature}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Development Notice */}
        <div className="max-w-2xl">
          <div className="p-4 rounded-lg border border-border bg-card">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground mb-1">Dashboard in Development</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This {roleName.toLowerCase()} dashboard is being customized with specific workflows and tools.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">View Documentation</Button>
                  <Button size="sm">
                    Request Demo
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Link to="/">
            <Button variant="outline" size="sm">
              Back to Home
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
