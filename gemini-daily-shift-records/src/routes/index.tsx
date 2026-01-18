import { Route, Switch } from "wouter";
import ManagerDashboard from "../pages/ManagerDashboard";
import ModernManagerDashboard from "../pages/ModernManagerDashboard";
import EnhancedManagerDashboard from "../pages/EnhancedManagerDashboard";
import SupervisorDashboard from "../pages/SupervisorDashboard";
import AttendantDashboard from "../pages/AttendantDashboard";
import Login from "../pages/Login";

export default function Routes() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/manager" component={ManagerDashboard} />
      <Route path="/manager-modern" component={ModernManagerDashboard} />
      <Route path="/manager-enhanced" component={EnhancedManagerDashboard} />
      <Route path="/supervisor" component={SupervisorDashboard} />
      <Route path="/attendant" component={AttendantDashboard} />
    </Switch>
  );
}