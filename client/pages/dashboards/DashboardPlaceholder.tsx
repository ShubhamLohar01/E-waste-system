import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Package,
  LogOut,
  ArrowRight,
  Zap,
  AlertCircle,
} from "lucide-react";

interface DashboardPlaceholderProps {
  roleName: string;
  roleDescription: string;
  trustLevel: string;
  features: string[];
  icon: typeof Package;
}

export default function DashboardPlaceholder({
  roleName,
  roleDescription,
  trustLevel,
  features,
  icon: Icon,
}: DashboardPlaceholderProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <Package className="w-5 h-5" />
              </div>
              <span className="font-bold text-foreground">E-Waste Hub</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{roleName}</span>
              <Button variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">{roleName}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            {roleDescription}
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary font-medium text-sm">
              <Zap className="w-4 h-4" />
              {trustLevel}
            </span>
          </div>
        </div>

        {/* Key Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
            Dashboard Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature}
                className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-accent/10 flex-shrink-0">
                    <Zap className="w-5 h-5 text-accent" />
                  </div>
                  <p className="font-medium text-foreground">{feature}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Development Notice */}
        <section className="max-w-2xl mx-auto">
          <div className="p-8 rounded-lg border border-accent/50 bg-accent/5">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Dashboard in Development
                </h3>
                <p className="text-muted-foreground mb-6">
                  This {roleName.toLowerCase()} dashboard is being customized with
                  specific workflows and tools. The full functionality will be
                  available soon.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <Button variant="outline">
                    View Documentation
                  </Button>
                  <Button>
                    Request Demo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Back to Home */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Want to try a different role?
          </p>
          <Link to="/">
            <Button variant="outline">
              Back to Home
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
