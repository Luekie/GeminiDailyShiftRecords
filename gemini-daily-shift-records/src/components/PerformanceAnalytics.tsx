import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip } from 'recharts';

interface AttendantPerformance {
  id: string;
  name: string;
  totalShifts: number;
  approvedShifts: number;
  rejectedShifts: number;
  pendingShifts: number;
  totalRevenue: number;
  totalVolume: number;
  averageVariance: number;
  accuracyScore: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
  lateSubmissions: number;
  criticalAlerts: number;
}

interface PerformanceAnalyticsProps {
  isDarkMode: boolean;
}

export default function PerformanceAnalytics({ isDarkMode }: PerformanceAnalyticsProps) {
  const [attendantPerformance, setAttendantPerformance] = useState<AttendantPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('accuracy');
  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedPeriod]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      // Build query
      let query = supabase
        .from('shifts')
        .select(`
          *,
          attendant:attendant_id(id, username)
        `);

      // Only apply date filter if not 'all'
      if (selectedPeriod !== 'all') {
        const endDate = new Date();
        const startDate = new Date();

        switch (selectedPeriod) {
          case 'week':
            startDate.setDate(endDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
          case 'quarter':
            startDate.setMonth(endDate.getMonth() - 3);
            break;
        }

        query = query
          .gte('shift_date', startDate.toISOString().slice(0, 10))
          .lte('shift_date', endDate.toISOString().slice(0, 10));
      }

      const { data: shiftsData, error } = await query;

      if (error) throw error;

      // Process performance data
      const performanceMap = new Map<string, any>();

      shiftsData?.forEach(shift => {
        const attendantId = shift.attendant_id;
        const attendantName = shift.attendant?.username || 'Unknown';

        if (!performanceMap.has(attendantId)) {
          performanceMap.set(attendantId, {
            id: attendantId,
            name: attendantName,
            totalShifts: 0,
            approvedShifts: 0,
            rejectedShifts: 0,
            pendingShifts: 0,
            totalRevenue: 0,
            totalVolume: 0,
            totalVariance: 0,
            lateSubmissions: 0,
            criticalAlerts: 0,
            shifts: []
          });
        }

        const attendant = performanceMap.get(attendantId);
        attendant.totalShifts++;

        // Count approval status based on existing fields
        if (shift.is_approved) {
          attendant.approvedShifts++;
        } else if (shift.fix_reason) {
          attendant.rejectedShifts++;
        } else {
          attendant.pendingShifts++;
        }

        // Calculate revenue and volume
        const revenue = (shift.cash_received || 0) + (shift.prepayment_received || 0) +
          (shift.credit_received || 0) + (shift.fuel_card_received || 0) +
          (shift.fdh_card_received || 0) + (shift.national_bank_card_received || 0) +
          (shift.mo_payment_received || 0);
        const volume = (shift.closing_reading || 0) - (shift.opening_reading || 0);
        const expected = volume * (shift.fuel_price || 0);
        const variance = revenue - expected;

        attendant.totalRevenue += revenue;
        attendant.totalVolume += volume;
        attendant.totalVariance += variance;

        // Check for critical alerts (variance > 5%)
        if (expected > 0 && Math.abs(variance / expected) > 0.05) {
          attendant.criticalAlerts++;
        }

        // Check for late submissions (submitted more than 2 hours after shift end)
        const submittedAt = new Date(shift.created_at);
        const shiftDate = new Date(shift.shift_date);
        const expectedSubmissionTime = new Date(shiftDate);

        if (shift.shift_type === 'day') {
          expectedSubmissionTime.setHours(18, 0, 0); // 6 PM
        } else {
          expectedSubmissionTime.setHours(8, 0, 0); // 8 AM next day
          expectedSubmissionTime.setDate(expectedSubmissionTime.getDate() + 1);
        }

        if (submittedAt > new Date(expectedSubmissionTime.getTime() + 2 * 60 * 60 * 1000)) {
          attendant.lateSubmissions++;
        }

        attendant.shifts.push(shift);
      });

      // Convert to array and calculate derived metrics
      const performanceArray: AttendantPerformance[] = Array.from(performanceMap.values()).map((attendant, _index) => {
        const averageVariance = attendant.totalShifts > 0 ? attendant.totalVariance / attendant.totalShifts : 0;
        const accuracyScore = attendant.totalShifts > 0 ?
          Math.max(0, 100 - (Math.abs(averageVariance) / (attendant.totalRevenue / attendant.totalShifts) * 100)) : 100;

        return {
          ...attendant,
          averageVariance,
          accuracyScore: Math.min(100, Math.max(0, accuracyScore)),
          rank: 0, // Will be calculated after sorting
          trend: calculateTrend(attendant.shifts) as 'up' | 'down' | 'stable'
        };
      });

      // Sort by selected metric and assign ranks
      performanceArray.sort((a, b) => {
        switch (selectedMetric) {
          case 'accuracy':
            return b.accuracyScore - a.accuracyScore;
          case 'revenue':
            return b.totalRevenue - a.totalRevenue;
          case 'volume':
            return b.totalVolume - a.totalVolume;
          case 'shifts':
            return b.totalShifts - a.totalShifts;
          default:
            return b.accuracyScore - a.accuracyScore;
        }
      });

      // Assign ranks
      performanceArray.forEach((attendant, index) => {
        attendant.rank = index + 1;
      });

      setAttendantPerformance(performanceArray);
      generateTrendData(performanceArray);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    }
    setLoading(false);
  };

  const calculateTrend = (shifts: any[]) => {
    if (shifts.length < 2) return 'stable';

    // Sort shifts by date
    const sortedShifts = shifts.sort((a, b) => new Date(a.shift_date).getTime() - new Date(b.shift_date).getTime());

    // Compare first half vs second half performance
    const midPoint = Math.floor(sortedShifts.length / 2);
    const firstHalf = sortedShifts.slice(0, midPoint);
    const secondHalf = sortedShifts.slice(midPoint);

    const firstHalfAccuracy = calculateAccuracy(firstHalf);
    const secondHalfAccuracy = calculateAccuracy(secondHalf);

    const difference = secondHalfAccuracy - firstHalfAccuracy;

    if (difference > 2) return 'up';
    if (difference < -2) return 'down';
    return 'stable';
  };

  const calculateAccuracy = (shifts: any[]) => {
    if (shifts.length === 0) return 100;

    let totalVariance = 0;
    let totalRevenue = 0;

    shifts.forEach(shift => {
      const revenue = (shift.cash_received || 0) + (shift.prepayment_received || 0) +
        (shift.credit_received || 0) + (shift.fuel_card_received || 0) +
        (shift.fdh_card_received || 0) + (shift.national_bank_card_received || 0) +
        (shift.mo_payment_received || 0);
      const volume = (shift.closing_reading || 0) - (shift.opening_reading || 0);
      const expected = volume * (shift.fuel_price || 0);
      const variance = Math.abs(revenue - expected);

      totalVariance += variance;
      totalRevenue += expected;
    });

    if (totalRevenue === 0) return 100;
    return Math.max(0, 100 - (totalVariance / totalRevenue * 100));
  };

  const generateTrendData = (performanceArray: AttendantPerformance[]) => {
    // Generate trend data for charts
    const trendData = performanceArray.slice(0, 10).map(attendant => ({
      name: attendant.name,
      accuracy: attendant.accuracyScore,
      revenue: attendant.totalRevenue,
      volume: attendant.totalVolume,
      shifts: attendant.totalShifts
    }));

    setTrendData(trendData);
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 95) return 'text-green-500';
    if (score >= 85) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 95) return { label: 'Excellent', color: 'bg-green-500/20 text-green-600 border-green-500/30' };
    if (score >= 85) return { label: 'Good', color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' };
    if (score >= 70) return { label: 'Average', color: 'bg-orange-500/20 text-orange-600 border-orange-500/30' };
    return { label: 'Needs Improvement', color: 'bg-red-500/20 text-red-600 border-red-500/30' };
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className={cn("text-2xl font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
          Performance Analytics
        </h2>

        <div className="flex gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={cn(
              "w-32 rounded-xl border backdrop-blur-sm",
              isDarkMode
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/30 border-white/40 text-gray-900"
            )}>
              {selectedPeriod === 'week' ? 'This Week' : selectedPeriod === 'month' ? 'This Month' : selectedPeriod === 'quarter' ? 'This Quarter' : 'All Time'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className={cn(
              "w-32 rounded-xl border backdrop-blur-sm",
              isDarkMode
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/30 border-white/40 text-gray-900"
            )}>
              {selectedMetric === 'accuracy' ? 'Accuracy' : selectedMetric === 'revenue' ? 'Revenue' : selectedMetric === 'volume' ? 'Volume' : 'Shifts'}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accuracy">Accuracy</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="shifts">Shifts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Ranking Chart */}
        <Card className={cn(
          "rounded-2xl shadow-lg border backdrop-blur-xl",
          isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
        )}>
          <CardContent className="p-6">
            <h3 className={cn("text-lg font-bold mb-4", isDarkMode ? "text-white" : "text-gray-900")}>
              Performance Ranking
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey={selectedMetric} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Accuracy Distribution */}
        <Card className={cn(
          "rounded-2xl shadow-lg border backdrop-blur-xl",
          isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
        )}>
          <CardContent className="p-6">
            <h3 className={cn("text-lg font-bold mb-4", isDarkMode ? "text-white" : "text-gray-900")}>
              Accuracy Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Excellent (95%+)', value: attendantPerformance.filter(a => a.accuracyScore >= 95).length, color: '#10b981' },
                    { name: 'Good (85-94%)', value: attendantPerformance.filter(a => a.accuracyScore >= 85 && a.accuracyScore < 95).length, color: '#f59e0b' },
                    { name: 'Average (70-84%)', value: attendantPerformance.filter(a => a.accuracyScore >= 70 && a.accuracyScore < 85).length, color: '#f97316' },
                    { name: 'Needs Improvement (<70%)', value: attendantPerformance.filter(a => a.accuracyScore < 70).length, color: '#ef4444' }
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {attendantPerformance.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Leaderboard */}
      <Card className={cn(
        "rounded-2xl shadow-lg border backdrop-blur-xl",
        isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
      )}>
        <CardContent className="p-6">
          <h3 className={cn("text-lg font-bold mb-6", isDarkMode ? "text-white" : "text-gray-900")}>
            Attendant Performance Leaderboard
          </h3>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {attendantPerformance.map((attendant, index) => {
                const badge = getPerformanceBadge(attendant.accuracyScore);

                return (
                  <div key={attendant.id} className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md",
                    isDarkMode ? "bg-white/5 border-white/10" : "bg-white/30 border-white/30"
                  )}>
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                          index === 1 ? "bg-gray-400/20 text-gray-600" :
                            index === 2 ? "bg-orange-500/20 text-orange-600" :
                              "bg-blue-500/20 text-blue-600"
                      )}>
                        {index < 3 ? (
                          index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
                        ) : (
                          attendant.rank
                        )}
                      </div>

                      {/* Attendant Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={cn("font-semibold", isDarkMode ? "text-white" : "text-gray-900")}>
                            {attendant.name}
                          </h4>
                          <span className={cn("px-2 py-1 rounded-lg text-xs font-semibold border", badge.color)}>
                            {badge.label}
                          </span>
                          {attendant.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                          {attendant.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                          {attendant.totalShifts} shifts • {attendant.approvedShifts} approved • {attendant.rejectedShifts} rejected
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className={cn("text-lg font-bold", getPerformanceColor(attendant.accuracyScore))}>
                          {attendant.accuracyScore.toFixed(1)}%
                        </div>
                        <div className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                          Accuracy
                        </div>
                      </div>

                      <div className="text-center">
                        <div className={cn("text-lg font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
                          {attendant.totalRevenue.toLocaleString()}
                        </div>
                        <div className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                          Revenue
                        </div>
                      </div>

                      <div className="text-center">
                        <div className={cn("text-lg font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
                          {attendant.totalVolume.toLocaleString()}L
                        </div>
                        <div className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                          Volume
                        </div>
                      </div>

                      {attendant.criticalAlerts > 0 && (
                        <div className="flex items-center gap-1 text-red-500">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm font-semibold">{attendant.criticalAlerts}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}