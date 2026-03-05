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
}: {
  title: string;
  description: string;
  icon: typeof Users;
  href: string;
  trustLevel: string;
}) => (
  <Link to={href}>
    <div className="group p-6 rounded-lg border border-border bg-card hover:shadow-lg hover:border-primary/50 transition-all duration-300 cursor-pointer h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary/10 text-secondary">
          {trustLevel}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="flex items-center text-primary font-medium text-sm group-hover:translate-x-1 transition-transform">
        Access Dashboard <ArrowRight className="w-4 h-4 ml-2" />
      </div>
    </div>
  </Link>
);

const FeatureItem = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Zap;
  title: string;
  description: string;
}) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-accent/20">
        <Icon className="h-6 w-6 text-accent" />
      </div>
    </div>
    <div>
      <h4 className="font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
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
    const roleMap: Record<string, string> = {
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <Recycle className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg text-foreground">
                E-Waste Hub
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <a
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a
                href="#roles"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
                    <Button size="sm">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full -ml-48 -mb-48 blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block mb-6">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm">
                  <Leaf className="w-4 h-4" />
                  Sustainable E-Waste Management
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
                The Middleware for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                  Responsible E-Waste
                </span>
              </h1>

              <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
                Connect e-waste generators with verified recyclers through an
                intelligent platform. Full traceability, QR-based tracking, and
                role-based coordination—no assets, just orchestration.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/dashboard/small-user">
                  <Button size="lg" className="w-full sm:w-auto">
                    Get Started as Small User
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </div>

              <div className="flex items-center gap-6 mt-12 pt-8 border-t border-border">
                <div>
                  <div className="text-2xl font-bold text-foreground">7</div>
                  <p className="text-sm text-muted-foreground">Role Types</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">∞</div>
                  <p className="text-sm text-muted-foreground">Scalability</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">100%</div>
                  <p className="text-sm text-muted-foreground">Traceable</p>
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 p-8">
                <div className="grid grid-cols-2 gap-4 h-full">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-white/50 backdrop-blur border border-white/20 p-4 flex items-center justify-center"
                    >
                      <div className="text-center">
                        <QrCode className="w-8 h-8 text-primary mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground font-medium">
                          Tracked
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Platform Capabilities
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete middleware solution for coordinating e-waste from
              source to responsible recycling
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureItem
              icon={QrCode}
              title="QR-Based Traceability"
              description="Every item tagged with QR codes for complete end-to-end tracking from source to recycler"
            />
            <FeatureItem
              icon={Shield}
              title="Trust Architecture"
              description="Role-based verification at every handoff ensures integrity across the supply chain"
            />
            <FeatureItem
              icon={TrendingUp}
              title="Supply-Demand Matching"
              description="Intelligent matching engine connects verified waste supply with recycler demand"
            />
            <FeatureItem
              icon={Users}
              title="7 Distinct Roles"
              description="From individual contributors to large generators and recycling companies"
            />
            <FeatureItem
              icon={Zap}
              title="Reward System"
              description="Gamified incentives for small users to encourage sustained participation"
            />
            <FeatureItem
              icon={Leaf}
              title="Environmental Impact"
              description="Certified traceability for compliance and responsible waste management"
            />
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Seven Specialized Roles
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Each role has its own dashboard, permissions, and workflows
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <RoleCard
              title="Small Individual Users"
              description="Submit e-waste and earn rewards for sustainable contribution"
              icon={Users}
              href="/dashboard/small-user"
              trustLevel="Low Trust"
            />
            <RoleCard
              title="Local Collectors"
              description="Pick up waste from multiple users and deliver to hubs"
              icon={Zap}
              href="/dashboard/collector"
              trustLevel="Medium Trust"
            />
            <RoleCard
              title="Main Hubs"
              description="Verify, categorize, and aggregate waste for distribution"
              icon={Shield}
              href="/dashboard/hub"
              trustLevel="High Trust"
            />
            <RoleCard
              title="Delivery Workers"
              description="Transport verified waste from hubs to recyclers"
              icon={TrendingUp}
              href="/dashboard/delivery"
              trustLevel="Low Trust"
            />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <RoleCard
              title="Recycling Companies"
              description="Submit demands and receive verified waste batches"
              icon={Recycle}
              href="/dashboard/recycler"
              trustLevel="High Trust"
            />
            <RoleCard
              title="Bulk Generators"
              description="Fast-track disposal for large-scale e-waste generators"
              icon={Leaf}
              href="/dashboard/bulk-generator"
              trustLevel="High Trust"
            />
            <RoleCard
              title="Admin Dashboard"
              description="System governance, user management, and dispute resolution"
              icon={Shield}
              href="/dashboard/admin"
              trustLevel="Highest"
            />
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              The Complete Flow
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              12-step system from intent to verified recycling
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                phase: "Intake",
                steps: [
                  "Intent submission by small users",
                  "Assignment to local collectors",
                  "Field collection & QR tagging",
                ],
              },
              {
                phase: "Aggregation",
                steps: [
                  "Hub delivery & logging",
                  "Verification & categorization",
                ],
              },
              {
                phase: "Matching",
                steps: [
                  "Recycler demand requests",
                  "Supply-demand matching",
                  "Delivery scheduling",
                ],
              },
              {
                phase: "Delivery & Closure",
                steps: [
                  "Transport to recycler",
                  "Receipt confirmation",
                  "Reward unlock",
                ],
              },
            ].map((section) => (
              <div
                key={section.phase}
                className="p-8 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <h3 className="text-xl font-semibold text-primary mb-4">
                  {section.phase}
                </h3>
                <ol className="space-y-3">
                  {section.steps.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 text-sm text-muted-foreground"
                    >
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-accent/20 text-accent font-semibold flex-shrink-0">
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
      <section className="py-20 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Transform E-Waste Management?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Select your role and join the sustainable e-waste revolution
          </p>
          <Link to="/dashboard/small-user">
            <Button size="lg" className="px-8">
              Access Your Dashboard
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                  <Recycle className="w-5 h-5" />
                </div>
                <span className="font-bold text-foreground">E-Waste Hub</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Middleware for responsible e-waste management
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Roles
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Compliance
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex items-center justify-between text-sm text-muted-foreground">
            <p>&copy; 2024 E-Waste Hub. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground transition-colors">
                Twitter
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                LinkedIn
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
