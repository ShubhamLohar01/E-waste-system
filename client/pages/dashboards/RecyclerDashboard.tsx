import DashboardPlaceholder from "./DashboardPlaceholder";
import { Recycle } from "lucide-react";

export default function RecyclerDashboard() {
  return (
    <DashboardPlaceholder
      roleName="Recycling Company"
      roleDescription="Submit demand requests, track scheduled deliveries, and confirm receipt via QR verification"
      trustLevel="High Trust"
      features={[
        "Submit demand requests for e-waste",
        "Track scheduled deliveries",
        "Confirm receipt via QR scan",
        "View processing history",
        "Raise disputes if discrepancies found",
        "Demand analytics and fulfillment tracking",
      ]}
      icon={Recycle}
    />
  );
}
