import DashboardPlaceholder from "./DashboardPlaceholder";
import { Leaf } from "lucide-react";

export default function BulkGeneratorDashboard() {
  return (
    <DashboardPlaceholder
      roleName="Bulk E-Waste Generator"
      roleDescription="Fast-track disposal for large organizations with standardized formats and compliance certificates"
      trustLevel="High Trust"
      features={[
        "Submit bulk e-waste manifests",
        "Schedule direct hub intake or pickup",
        "View compliance certificates",
        "Track disposal history",
        "Bulk reporting and analytics",
        "Regulatory compliance documentation",
      ]}
      icon={Leaf}
    />
  );
}
