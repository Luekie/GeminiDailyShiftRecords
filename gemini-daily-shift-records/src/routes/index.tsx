import { Route, Switch } from "wouter";
import EnhancedManagerDashboard from "../pages/EnhancedManagerDashboard";
import SupervisorDashboard from "../pages/SupervisorDashboard";
import AttendantDashboard from "../pages/AttendantDashboard";
import Login from "../pages/Login";
import SetupPassword from "../pages/SetupPassword";
import DiagnosticPage from "../pages/DiagnosticPage";

export default function Routes() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/setup-password" component={SetupPassword} />
      <Route path="/diagnostic" component={DiagnosticPage} />
      <Route path="/manager" component={EnhancedManagerDashboard} />
      <Route path="/manager-enhanced" component={EnhancedManagerDashboard} />
      <Route path="/supervisor" component={SupervisorDashboard} />
      <Route path="/attendant" component={AttendantDashboard} />
    </Switch>
  );
}