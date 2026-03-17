import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Recycle,
  Zap,
  TrendingUp,
  QrCode,
  Shield,
  Leaf,
  ArrowRight,
  LogOut,
} from "lucide-react";

const RoleCard = ({
  title,
  description,
  icon: Icon,
  href,
  trustLevel,
}) => (
  <Link to={href}>
    <div className="p-5 rounded-lg border border-border bg-card hover:border-primary/50 cursor-pointer h-full">
      <div className="flex items-start justify-between mb-3">
        <Icon className="w-5 h-5 text-primary" />
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {trustLevel}
        </span>
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <div className="flex items-center text-primary text-sm">
        Access Dashboard <ArrowRight className="w-4 h-4 ml-1" />
      </div>
    </div>
  </Link>
);

export default function Index() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getDashboardUrl = () => {
    if (!user) return "/";
    const roleMap = {
      small_user: "/dashboard/small-user",
      local_collector: "/dashboard/collector",
      hub: "/dashboard/hub",
      delivery_worker: "/dashboard/delivery",
      recycler: "/dashboard/recycler",
      bulk_generator: "/dashboard/bulk-generator",
      admin: "/dashboard/admin",
    };
    return roleMap[user.role] || "/";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2">
              <Recycle className="w-5 h-5 text-primary" />
              <span className="font-bold text-foreground">E-Waste Hub</span>
            </Link>
            <div className="flex items-center gap-3">
              <a
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Features
              </a>
              <a
                href="#roles"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Roles
              </a>
              {isAuthenticated ? (
                <>
                  <Link to={getDashboardUrl()}>
                    <Button variant="outline" size="sm">
                      Dashboard
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="outline" size="sm">
                      Login
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm">Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              The Middleware for Responsible E-Waste
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Connect e-waste generators with verified recyclers through an
              intelligent platform. Full traceability, QR-based tracking, and
              role-based coordination.
            </p>
            <div className="flex gap-3">
              <Link to="/dashboard/small-user">
                <Button>
                  Get Started
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Button variant="outline">Learn More</Button>
            </div>
            <div className="flex items-center gap-8 mt-8 pt-6 border-t border-border">
              <div>
                <div className="text-xl font-bold text-foreground">7</div>
                <p className="text-sm text-muted-foreground">Role Types</p>
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">100%</div>
                <p className="text-sm text-muted-foreground">Traceable</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="py-12 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Platform Capabilities
          </h2>
          <p className="text-muted-foreground mb-8">
            A complete middleware solution for coordinating e-waste from source
            to responsible recycling
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: QrCode, title: "QR-Based Traceability", description: "Every item tagged with QR codes for end-to-end tracking" },
              { icon: Shield, title: "Trust Architecture", description: "Role-based verification at every handoff ensures integrity" },
              { icon: TrendingUp, title: "Supply-Demand Matching", description: "Intelligent matching connects waste supply with recycler demand" },
              { icon: Users, title: "7 Distinct Roles", description: "From individual contributors to large generators and recyclers" },
              { icon: Zap, title: "Reward System", description: "Gamified incentives for small users to encourage participation" },
              { icon: Leaf, title: "Environmental Impact", description: "Certified traceability for compliance and responsible management" },
            ].map((feature) => (
              <div key={feature.title} className="flex gap-3">
                <feature.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-foreground mb-1">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="py-12 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Seven Specialized Roles
          </h2>
          <p className="text-muted-foreground mb-8">
            Each role has its own dashboard, permissions, and workflows
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <RoleCard title="Small Individual Users" description="Submit e-waste and earn rewards" icon={Users} href="/dashboard/small-user" trustLevel="Low Trust" />
            <RoleCard title="Local Collectors" description="Pick up waste from users and deliver to hubs" icon={Zap} href="/dashboard/collector" trustLevel="Medium Trust" />
            <RoleCard title="Main Hubs" description="Verify, categorize, and aggregate waste" icon={Shield} href="/dashboard/hub" trustLevel="High Trust" />
            <RoleCard title="Delivery Workers" description="Transport verified waste to recyclers" icon={TrendingUp} href="/dashboard/delivery" trustLevel="Low Trust" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <RoleCard title="Recycling Companies" description="Submit demands and receive verified batches" icon={Recycle} href="/dashboard/recycler" trustLevel="High Trust" />
            <RoleCard title="Bulk Generators" description="Fast-track disposal for large-scale generators" icon={Leaf} href="/dashboard/bulk-generator" trustLevel="High Trust" />
            <RoleCard title="Admin Dashboard" description="System governance and dispute resolution" icon={Shield} href="/dashboard/admin" trustLevel="Highest" />
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-12 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            The Complete Flow
          </h2>
          <p className="text-muted-foreground mb-8">
            12-step system from intent to verified recycling
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { phase: "Intake", steps: ["Intent submission by small users", "Assignment to local collectors", "Field collection & QR tagging"] },
              { phase: "Aggregation", steps: ["Hub delivery & logging", "Verification & categorization"] },
              { phase: "Matching", steps: ["Recycler demand requests", "Supply-demand matching", "Delivery scheduling"] },
              { phase: "Delivery & Closure", steps: ["Transport to recycler", "Receipt confirmation", "Reward unlock"] },
            ].map((section) => (
              <div key={section.phase} className="p-5 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-primary mb-3">{section.phase}</h3>
                <ol className="space-y-2">
                  {section.steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-foreground text-xs font-medium flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Ready to Transform E-Waste Management?
          </h2>
          <p className="text-muted-foreground mb-6">
            Select your role and join the sustainable e-waste revolution
          </p>
          <Link to="/dashboard/small-user">
            <Button>
              Access Your Dashboard
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Recycle className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">E-Waste Hub</span>
              <span>&copy; 2024</span>
            </div>
            <div className="flex gap-4">
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Terms</a>
              <a href="#" className="hover:text-foreground">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
