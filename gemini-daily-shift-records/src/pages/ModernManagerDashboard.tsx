// Fixed TypeScript imports - removed unused imports
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAtomValue } from 'jotai';
import { userAtom } from '../store/auth';
import { useLocation } from 'wouter';
import { useTheme } from '../contexts/ThemeContext';
import { GlobalBackground } from '../components/GlobalBackground';
import { 
  TrendingUp, 
  BarChart3, 
  Fuel, 
  CreditCard, 
  Moon,
  Sun,
  Bell,
  Calendar,
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

const fetchSummaries = async (shift: string) => {
  const { data, error } = await supabase
    .from("shifts")
    .select("*, attendant:attendant_id(username)")
    .eq("shift_type", shift)
    .order("shift_date", { ascending: false });
  if (error) throw error;
  
  const grouped: Record<string, any> = {};
  for (const row of data) {
    const key = `${row.attendant_id}-${row.shift_date}`;
    if (!grouped[key]) {
      grouped[key] = {
        attendantName: row.attendant?.username || row.attendant_id,
        shift: row.shift_type,
        date: row.shift_date,
        totalRevenue: 0,
        totalVolume: 0,
        transactions: 0,
      };
    }
    grouped[key].totalRevenue += (row.cash_received || 0) + (row.prepayment_received || 0) + (row.credit_received || 0);
    grouped[key].totalVolume += (row.closing_reading - row.opening_reading) || 0;
    grouped[key].transactions += 1;
  }
  return Object.values(grouped);
};

export default function ModernManagerDashboard() {
  const user = useAtomValue(userAtom);
  const [, setLocation] = useLocation();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedShift, setSelectedShift] = useState('all');

  const { data: summaries = [] } = useQuery({
    queryKey: ["manager-modern", selectedShift],
    queryFn: () => selectedShift === "all"
      ? Promise.all([fetchSummaries("day"), fetchSummaries("night")]).then(arr => arr.flat())
      : fetchSummaries(selectedShift),
  });

  // Mock data for enhanced dashboard
  const kpiData = {
    totalRevenue: 125430,
    totalVolume: 8420,
    activeStations: 12,
    completedShifts: 24,
    pendingApprovals: 3,
    alerts: 1
  };

  const chartData = [
    { name: 'Mon', revenue: 12000, volume: 800 },
    { name: 'Tue', revenue: 15000, volume: 950 },
    { name: 'Wed', revenue: 18000, volume: 1200 },
    { name: 'Thu', revenue: 14000, volume: 900 },
    { name: 'Fri', revenue: 22000, volume: 1400 },
    { name: 'Sat', revenue: 25000, volume: 1600 },
    { name: 'Sun', revenue: 19000, volume: 1200 },
  ];

  const pieData = [
    { name: 'Cash', value: 45, color: '#10b981' },
    { name: 'Card', value: 35, color: '#3b82f6' },
    { name: 'Mobile', value: 20, color: '#8b5cf6' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation("/");
  };

  return (
    <>
      <GlobalBackground />
      <div className="relative min-h-screen w-full p-4 space-y-6 z-10">
        {/* Modern Header */}
        <div className={cn(
          "flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-6 rounded-3xl shadow-2xl border backdrop-blur-xl",
          isDarkMode 
            ? "bg-white/5 border-white/10 text-white" 
            : "bg-white/20 border-white/30 text-gray-900"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isDarkMode ? "bg-blue-500/20" : "bg-blue-500/30"
            )}>
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Manager Dashboard</h1>
              <p className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                Welcome back, {user?.username}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              className={cn(
                "rounded-xl p-2 transition-all duration-200",
                isDarkMode 
                  ? "hover:bg-white/10 text-white" 
                  : "hover:bg-white/20 text-gray-700"
              )}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-xl p-2 transition-all duration-200",
                isDarkMode 
                  ? "hover:bg-white/10 text-white" 
                  : "hover:bg-white/20 text-gray-700"
              )}
            >
              <Bell className="w-5 h-5" />
            </Button>

            <Button
              onClick={handleLogout}
              className={cn(
                "rounded-xl px-4 py-2 font-semibold transition-all duration-200",
                isDarkMode
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  : "bg-red-100/80 hover:bg-red-200/90 text-red-800 border border-red-300"
              )}
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className={cn(
          "flex flex-wrap items-center gap-4 p-4 rounded-2xl backdrop-blur-xl border",
          isDarkMode 
            ? "bg-white/5 border-white/10" 
            : "bg-white/20 border-white/30"
        )}>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={cn(
              "w-40 rounded-xl border backdrop-blur-sm",
              isDarkMode 
                ? "bg-white/10 border-white/20 text-white" 
                : "bg-white/30 border-white/40 text-gray-900"
            )}>
              <Calendar className="w-4 h-4 mr-2" />
              {selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedShift} onValueChange={setSelectedShift}>
            <SelectTrigger className={cn(
              "w-40 rounded-xl border backdrop-blur-sm",
              isDarkMode 
                ? "bg-white/10 border-white/20 text-white" 
                : "bg-white/30 border-white/40 text-gray-900"
            )}>
              <Clock className="w-4 h-4 mr-2" />
              {selectedShift === 'all' ? 'All Shifts' : selectedShift === 'day' ? 'Day Shift' : 'Night Shift'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="day">Day Shift</SelectItem>
              <SelectItem value="night">Night Shift</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { title: 'Total Revenue', value: `MWK ${kpiData.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'green', change: '+12.5%' },
            { title: 'Volume Sold', value: `${kpiData.totalVolume.toLocaleString()}L`, icon: Fuel, color: 'blue', change: '+8.2%' },
            { title: 'Active Stations', value: kpiData.activeStations, icon: Zap, color: 'purple', change: '100%' },
            { title: 'Completed Shifts', value: kpiData.completedShifts, icon: CheckCircle, color: 'emerald', change: '+5.1%' },
            { title: 'Pending Approvals', value: kpiData.pendingApprovals, icon: Clock, color: 'orange', change: '-2' },
            { title: 'Active Alerts', value: kpiData.alerts, icon: AlertTriangle, color: 'red', change: '-1' },
          ].map((kpi, index) => (
            <Card key={index} className={cn(
              "rounded-2xl backdrop-blur-xl border transition-all duration-200 hover:scale-105",
              isDarkMode 
                ? "bg-white/5 border-white/10 hover:bg-white/10" 
                : "bg-white/20 border-white/30 hover:bg-white/30"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    `bg-${kpi.color}-500/20`
                  )}>
                    <kpi.icon className={`w-5 h-5 text-${kpi.color}-400`} />
                  </div>
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-lg",
                    kpi.change.startsWith('+') 
                      ? isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"
                      : isDarkMode ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700"
                  )}>
                    {kpi.change}
                  </span>
                </div>
                <div className={cn(
                  "text-2xl font-bold mb-1",
                  isDarkMode ? "text-white" : "text-gray-900"
                )}>
                  {kpi.value}
                </div>
                <div className={cn(
                  "text-sm",
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  {kpi.title}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <Card className={cn(
            "rounded-2xl backdrop-blur-xl border",
            isDarkMode 
              ? "bg-white/5 border-white/10" 
              : "bg-white/20 border-white/30"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-lg font-semibold",
                  isDarkMode ? "text-white" : "text-gray-900"
                )}>
                  Revenue Trend
                </h3>
                <TrendingUp className={cn(
                  "w-5 h-5",
                  isDarkMode ? "text-green-400" : "text-green-600"
                )} />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
                        border: 'none',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fill="url(#revenueGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className={cn(
            "rounded-2xl backdrop-blur-xl border",
            isDarkMode 
              ? "bg-white/5 border-white/10" 
              : "bg-white/20 border-white/30"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-lg font-semibold",
                  isDarkMode ? "text-white" : "text-gray-900"
                )}>
                  Payment Methods
                </h3>
                <CreditCard className={cn(
                  "w-5 h-5",
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                )} />
              </div>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {pieData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className={cn(
                      "text-sm",
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    )}>
                      {entry.name} ({entry.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className={cn(
          "rounded-2xl backdrop-blur-xl border",
          isDarkMode 
            ? "bg-white/5 border-white/10" 
            : "bg-white/20 border-white/30"
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className={cn(
                "text-lg font-semibold",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                Recent Activity
              </h3>
              <Activity className={cn(
                "w-5 h-5",
                isDarkMode ? "text-purple-400" : "text-purple-600"
              )} />
            </div>
            <div className="space-y-4">
              {[
                { user: 'John Doe', action: 'completed shift', time: '2 minutes ago', status: 'success' },
                { user: 'Jane Smith', action: 'submitted readings', time: '5 minutes ago', status: 'pending' },
                { user: 'Mike Johnson', action: 'requested approval', time: '10 minutes ago', status: 'warning' },
                { user: 'Sarah Wilson', action: 'logged out', time: '15 minutes ago', status: 'info' },
              ].map((activity, index) => (
                <div key={index} className={cn(
                  "flex items-center gap-4 p-3 rounded-xl transition-colors",
                  isDarkMode ? "hover:bg-white/5" : "hover:bg-white/20"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold",
                    activity.status === 'success' ? "bg-green-500/20 text-green-400" :
                    activity.status === 'pending' ? "bg-orange-500/20 text-orange-400" :
                    activity.status === 'warning' ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-blue-500/20 text-blue-400"
                  )}>
                    {activity.user.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "font-medium",
                      isDarkMode ? "text-white" : "text-gray-900"
                    )}>
                      {activity.user} {activity.action}
                    </p>
                    <p className={cn(
                      "text-sm",
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    )}>
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}