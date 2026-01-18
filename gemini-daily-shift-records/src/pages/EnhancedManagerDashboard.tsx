import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAtomValue } from 'jotai';
import { userAtom } from '../store/auth';
import { useLocation } from 'wouter';
import { useTheme } from '../contexts/ThemeContext';
import { GlobalBackground } from '../components/GlobalBackground';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Users,
  Fuel,
  DollarSign,
  Calendar,
  Download,
  Bell,
  Eye,
  Filter,
  Search,
  Moon,
  Sun,
  BarChart3,
  FileText,
  Activity
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ShiftRecord {
  id: string;
  attendant_id: string;
  attendant: { username: string };
  supervisor_id?: string;
  supervisor?: { username: string };
  pump_id: string;
  pump: { name: string };
  shift_type: 'day' | 'night';
  shift_date: string;
  opening_reading: number;
  closing_reading: number;
  fuel_price: number;
  cash_received: number;
  prepayment_received: number;
  credit_received: number;
  fuel_card_received: number;
  fdh_card_received: number;
  national_bank_card_received: number;
  mo_payment_received: number;
  is_approved: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  submitted_at: string;
  created_at: string;
}

export default function EnhancedManagerDashboard() {
  const user = useAtomValue(userAtom);
  const [, setLocation] = useLocation();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  // State management
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedShift, setSelectedShift] = useState<'all' | 'day' | 'night'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedAttendant, setSelectedAttendant] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data states
  const [attendants, setAttendants] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [pumps, setPumps] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  
  // Modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingShift, setRejectingShift] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [selectedDate, selectedShift, selectedStatus, selectedAttendant]);

  const fetchInitialData = async () => {
    try {
      // Fetch attendants
      const { data: attendantsData } = await supabase
        .from('users')
        .select('id, username')
        .eq('role', 'attendant')
        .order('username');
      
      // Fetch supervisors
      const { data: supervisorsData } = await supabase
        .from('users')
        .select('id, username')
        .eq('role', 'supervisor')
        .order('username');
      
      // Fetch pumps
      const { data: pumpsData } = await supabase
        .from('pumps')
        .select('id, name')
        .order('name');

      setAttendants(attendantsData || []);
      setSupervisors(supervisorsData || []);
      setPumps(pumpsData || []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchShifts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('shifts')
        .select(`
          *,
          attendant:attendant_id(username),
          supervisor:supervisor_id(username),
          pump:pump_id(name)
        `)
        .eq('shift_date', selectedDate)
        .order('created_at', { ascending: false });

      // Apply filters
      if (selectedShift !== 'all') {
        query = query.eq('shift_type', selectedShift);
      }
      
      if (selectedStatus !== 'all') {
        query = query.eq('approval_status', selectedStatus);
      }
      
      if (selectedAttendant !== 'all') {
        query = query.eq('attendant_id', selectedAttendant);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      setShifts(data || []);
      calculateAnalytics(data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
    setLoading(false);
  };

  const calculateAnalytics = (shiftsData: ShiftRecord[]) => {
    const analytics = {
      totalShifts: shiftsData.length,
      pendingApprovals: shiftsData.filter(s => s.approval_status === 'pending').length,
      approvedShifts: shiftsData.filter(s => s.approval_status === 'approved').length,
      rejectedShifts: shiftsData.filter(s => s.approval_status === 'rejected').length,
      totalRevenue: shiftsData.reduce((sum, s) => sum + (s.cash_received + s.prepayment_received + s.credit_received + s.fuel_card_received + s.fdh_card_received + s.national_bank_card_received + s.mo_payment_received), 0),
      totalVolume: shiftsData.reduce((sum, s) => sum + (s.closing_reading - s.opening_reading), 0),
      averageVariance: 0,
      criticalAlerts: shiftsData.filter(s => {
        const expected = (s.closing_reading - s.opening_reading) * s.fuel_price;
        const actual = s.cash_received + s.prepayment_received + s.credit_received + s.fuel_card_received + s.fdh_card_received + s.national_bank_card_received + s.mo_payment_received;
        const variance = Math.abs(expected - actual);
        return variance > expected * 0.05; // 5% variance threshold
      }).length,
      attendantPerformance: {},
      missingShifts: calculateMissingShifts(shiftsData)
    };

    // Calculate attendant performance
    attendants.forEach(attendant => {
      const attendantShifts = shiftsData.filter(s => s.attendant_id === attendant.id);
      const totalExpected = attendantShifts.reduce((sum, s) => sum + ((s.closing_reading - s.opening_reading) * s.fuel_price), 0);
      const totalActual = attendantShifts.reduce((sum, s) => sum + (s.cash_received + s.prepayment_received + s.credit_received + s.fuel_card_received + s.fdh_card_received + s.national_bank_card_received + s.mo_payment_received), 0);
      
      analytics.attendantPerformance[attendant.id] = {
        name: attendant.username,
        shifts: attendantShifts.length,
        variance: totalActual - totalExpected,
        accuracy: totalExpected > 0 ? ((totalActual / totalExpected) * 100) : 100,
        approved: attendantShifts.filter(s => s.approval_status === 'approved').length,
        pending: attendantShifts.filter(s => s.approval_status === 'pending').length,
        rejected: attendantShifts.filter(s => s.approval_status === 'rejected').length
      };
    });

    setAnalytics(analytics);
  };

  const calculateMissingShifts = (shiftsData: ShiftRecord[]) => {
    // Calculate expected shifts vs actual shifts
    const expectedShifts = attendants.length * 2; // Assuming day and night shifts
    const actualShifts = shiftsData.length;
    return Math.max(0, expectedShifts - actualShifts);
  };

  const approveShift = async (shiftId: string) => {
    try {
      const { error } = await supabase
        .from('shifts')
        .update({
          approval_status: 'approved',
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', shiftId);

      if (error) throw error;
      
      fetchShifts(); // Refresh data
      showNotification('Shift approved successfully', 'success');
    } catch (error) {
      console.error('Error approving shift:', error);
      showNotification('Failed to approve shift', 'error');
    }
  };

  const rejectShift = async () => {
    if (!rejectingShift || !rejectionReason.trim()) return;

    try {
      const { error } = await supabase
        .from('shifts')
        .update({
          approval_status: 'rejected',
          is_approved: false,
          rejection_reason: rejectionReason,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', rejectingShift);

      if (error) throw error;
      
      setShowRejectModal(false);
      setRejectingShift(null);
      setRejectionReason('');
      fetchShifts(); // Refresh data
      showNotification('Shift rejected successfully', 'success');
    } catch (error) {
      console.error('Error rejecting shift:', error);
      showNotification('Failed to reject shift', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-xl shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  const exportReport = () => {
    const reportData = shifts.map(shift => ({
      'Date': shift.shift_date,
      'Attendant': shift.attendant?.username,
      'Supervisor': shift.supervisor?.username || 'N/A',
      'Pump': shift.pump?.name,
      'Shift': shift.shift_type,
      'Opening': shift.opening_reading,
      'Closing': shift.closing_reading,
      'Volume': shift.closing_reading - shift.opening_reading,
      'Expected Revenue': (shift.closing_reading - shift.opening_reading) * shift.fuel_price,
      'Actual Revenue': shift.cash_received + shift.prepayment_received + shift.credit_received + shift.fuel_card_received + shift.fdh_card_received + shift.national_bank_card_received + shift.mo_payment_received,
      'Variance': (shift.cash_received + shift.prepayment_received + shift.credit_received + shift.fuel_card_received + shift.fdh_card_received + shift.national_bank_card_received + shift.mo_payment_received) - ((shift.closing_reading - shift.opening_reading) * shift.fuel_price),
      'Status': shift.approval_status,
      'Rejection Reason': shift.rejection_reason || 'N/A',
      'Submitted At': new Date(shift.submitted_at).toLocaleString(),
      'Approved At': shift.approved_at ? new Date(shift.approved_at).toLocaleString() : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manager Report');
    XLSX.writeFile(wb, `manager-report-${selectedDate}.xlsx`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation("/");
  };

  // Filter shifts based on search term
  const filteredShifts = shifts.filter(shift => 
    shift.attendant?.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shift.pump?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <GlobalBackground />
      <div className="relative min-h-screen w-full p-4 space-y-6 z-10">
        {/* Header */}
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
              <h1 className="text-2xl font-bold">Enhanced Manager Dashboard</h1>
              <p className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                Complete Control & Accountability System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {analytics.criticalAlerts > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-xl">
                <Bell className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-semibold">{analytics.criticalAlerts} Alerts</span>
              </div>
            )}
            
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

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className={cn(
            "rounded-2xl shadow-lg border backdrop-blur-xl",
            isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-sm font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Pending Approvals
                  </p>
                  <p className="text-3xl font-bold text-orange-500">{analytics.pendingApprovals}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "rounded-2xl shadow-lg border backdrop-blur-xl",
            isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-sm font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Total Revenue
                  </p>
                  <p className="text-3xl font-bold text-green-500">{analytics.totalRevenue?.toLocaleString()}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "rounded-2xl shadow-lg border backdrop-blur-xl",
            isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-sm font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Critical Alerts
                  </p>
                  <p className="text-3xl font-bold text-red-500">{analytics.criticalAlerts}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "rounded-2xl shadow-lg border backdrop-blur-xl",
            isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
          )}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("text-sm font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Missing Shifts
                  </p>
                  <p className="text-3xl font-bold text-yellow-500">{analytics.missingShifts}</p>
                </div>
                <Users className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className={cn(
          "rounded-2xl shadow-lg border backdrop-blur-xl",
          isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
        )}>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className={cn("block text-sm font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Date
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={cn(
                    "rounded-xl border backdrop-blur-sm",
                    isDarkMode 
                      ? "bg-white/10 border-white/20 text-white" 
                      : "bg-white/30 border-white/40 text-gray-900"
                  )}
                />
              </div>

              <div>
                <label className={cn("block text-sm font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Shift
                </label>
                <Select value={selectedShift} onValueChange={(value: any) => setSelectedShift(value)}>
                  <SelectTrigger className={cn(
                    "rounded-xl border backdrop-blur-sm",
                    isDarkMode 
                      ? "bg-white/10 border-white/20 text-white" 
                      : "bg-white/30 border-white/40 text-gray-900"
                  )}>
                    {selectedShift === 'all' ? 'All Shifts' : selectedShift === 'day' ? 'Day Shift' : 'Night Shift'}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    <SelectItem value="day">Day Shift</SelectItem>
                    <SelectItem value="night">Night Shift</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className={cn("block text-sm font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Status
                </label>
                <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                  <SelectTrigger className={cn(
                    "rounded-xl border backdrop-blur-sm",
                    isDarkMode 
                      ? "bg-white/10 border-white/20 text-white" 
                      : "bg-white/30 border-white/40 text-gray-900"
                  )}>
                    {selectedStatus === 'all' ? 'All Status' : selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className={cn("block text-sm font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Attendant
                </label>
                <Select value={selectedAttendant} onValueChange={setSelectedAttendant}>
                  <SelectTrigger className={cn(
                    "rounded-xl border backdrop-blur-sm",
                    isDarkMode 
                      ? "bg-white/10 border-white/20 text-white" 
                      : "bg-white/30 border-white/40 text-gray-900"
                  )}>
                    {selectedAttendant === 'all' ? 'All Attendants' : attendants.find(a => a.id === selectedAttendant)?.username}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Attendants</SelectItem>
                    {attendants.map(attendant => (
                      <SelectItem key={attendant.id} value={attendant.id}>
                        {attendant.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className={cn("block text-sm font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      "pl-10 rounded-xl border backdrop-blur-sm",
                      isDarkMode 
                        ? "bg-white/10 border-white/20 text-white" 
                        : "bg-white/30 border-white/40 text-gray-900"
                    )}
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={exportReport}
                  className={cn(
                    "w-full rounded-xl px-4 py-2 font-semibold transition-all duration-200",
                    isDarkMode
                      ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
                      : "bg-blue-100/80 hover:bg-blue-200/90 text-blue-800 border border-blue-300"
                  )}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shifts Table */}
        <Card className={cn(
          "rounded-2xl shadow-lg border backdrop-blur-xl",
          isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
        )}>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className={cn("text-xl font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
                Shift Records ({filteredShifts.length})
              </h2>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      "border-b",
                      isDarkMode ? "border-white/20" : "border-gray-300"
                    )}>
                      <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Attendant
                      </th>
                      <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Pump
                      </th>
                      <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Shift
                      </th>
                      <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Volume
                      </th>
                      <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Revenue
                      </th>
                      <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Variance
                      </th>
                      <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Status
                      </th>
                      <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShifts.map((shift) => {
                      const volume = shift.closing_reading - shift.opening_reading;
                      const expected = volume * shift.fuel_price;
                      const actual = shift.cash_received + shift.prepayment_received + shift.credit_received + shift.fuel_card_received + shift.fdh_card_received + shift.national_bank_card_received + shift.mo_payment_received;
                      const variance = actual - expected;
                      const variancePercent = expected > 0 ? (variance / expected) * 100 : 0;

                      return (
                        <tr key={shift.id} className={cn(
                          "border-b hover:bg-white/5 transition-colors",
                          isDarkMode ? "border-white/10" : "border-gray-200"
                        )}>
                          <td className="p-3">
                            <div className={cn("font-semibold", isDarkMode ? "text-white" : "text-gray-900")}>
                              {shift.attendant?.username}
                            </div>
                            <div className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                              {new Date(shift.submitted_at).toLocaleString()}
                            </div>
                          </td>
                          <td className={cn("p-3", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                            {shift.pump?.name}
                          </td>
                          <td className="p-3">
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-xs font-semibold",
                              shift.shift_type === 'day' 
                                ? "bg-yellow-500/20 text-yellow-600" 
                                : "bg-blue-500/20 text-blue-600"
                            )}>
                              {shift.shift_type === 'day' ? '☀️ Day' : '🌙 Night'}
                            </span>
                          </td>
                          <td className={cn("p-3", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                            {volume.toLocaleString()}L
                          </td>
                          <td className={cn("p-3", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                            {actual.toLocaleString()}
                          </td>
                          <td className="p-3">
                            <div className={cn(
                              "flex items-center gap-1 font-semibold",
                              Math.abs(variancePercent) > 5 
                                ? "text-red-500" 
                                : variance >= 0 
                                  ? "text-green-500" 
                                  : "text-orange-500"
                            )}>
                              {variance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              {variance >= 0 ? '+' : ''}{variance.toLocaleString()}
                              <span className="text-xs">({variancePercent.toFixed(1)}%)</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-xs font-semibold",
                              shift.approval_status === 'approved' 
                                ? "bg-green-500/20 text-green-600" 
                                : shift.approval_status === 'rejected'
                                  ? "bg-red-500/20 text-red-600"
                                  : "bg-orange-500/20 text-orange-600"
                            )}>
                              {shift.approval_status === 'approved' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                              {shift.approval_status === 'rejected' && <XCircle className="w-3 h-3 inline mr-1" />}
                              {shift.approval_status === 'pending' && <Clock className="w-3 h-3 inline mr-1" />}
                              {shift.approval_status.charAt(0).toUpperCase() + shift.approval_status.slice(1)}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              {shift.approval_status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => approveShift(shift.id)}
                                    className="bg-green-500/20 hover:bg-green-500/30 text-green-600 border border-green-500/30 rounded-lg px-3 py-1 text-xs"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setRejectingShift(shift.id);
                                      setShowRejectModal(true);
                                    }}
                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-600 border border-red-500/30 rounded-lg px-3 py-1 text-xs"
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 border border-blue-500/30 rounded-lg px-3 py-1 text-xs"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rejection Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md p-6 relative border border-white/30">
              <h3 className="font-bold text-2xl mb-4 text-gray-900">Reject Shift</h3>
              <div className="space-y-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-2">
                    Reason for Rejection
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejecting this shift..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none h-24"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectingShift(null);
                      setRejectionReason('');
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl py-2 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={rejectShift}
                    disabled={!rejectionReason.trim()}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject Shift
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}