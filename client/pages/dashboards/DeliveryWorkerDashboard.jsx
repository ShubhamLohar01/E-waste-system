import DashboardPlaceholder from "./DashboardPlaceholder";
import { TrendingUp } from "lucide-react";

export default function DeliveryWorkerDashboard() {
  return (
    <DashboardPlaceholder
      roleName="Delivery Worker"
      roleDescription="Transport verified e-waste from hubs to recyclers with QR verification at every handoff"
      trustLevel="Low Trust"
      features={[
        "View delivery assignments",
        "Confirm hub pickup via QR scan",
        "Confirm recycler delivery via QR scan",
        "Generate and view delivery manifests",
        "Track earnings and performance score",
        "Delivery history and ratings",
      ]}
      icon={TrendingUp}
    />
  );
}
