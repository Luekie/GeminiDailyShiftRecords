import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAtomValue } from 'jotai';
import { userAtom } from '../store/auth';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  Users,
  X,
  Eye,
  CheckCircle,
  Bell
} from 'lucide-react';

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  shift_id?: string;
  is_read: boolean;
  created_at: string;
  expires_at?: string;
}

interface AlertSystemProps {
  isDarkMode: boolean;
}

export default function AlertSystem({ isDarkMode }: AlertSystemProps) {
  const user = useAtomValue(userAtom);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAlerts();

      // Set up real-time subscription for new alerts
      const subscription = supabase
        .channel('alerts')
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'alerts',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setAlerts(prev => [payload.new as Alert, ...prev]);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchAlerts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(showAll ? 100 : 10);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
    setLoading(false);
  };

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadAlerts = alerts.filter(alert => !alert.is_read);

      if (unreadAlerts.length === 0) return;

      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .in('id', unreadAlerts.map(alert => alert.id));

      if (error) throw error;

      setAlerts(prev => prev.map(alert => ({ ...alert, is_read: true })));
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/10';
      case 'error':
        return 'border-red-400/50 bg-red-400/10';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10';
      default:
        return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'high_variance':
        return <TrendingDown className="w-4 h-4" />;
      case 'missing_shift':
        return <Clock className="w-4 h-4" />;
      case 'late_submission':
        return <Clock className="w-4 h-4" />;
      case 'attendant_performance':
        return <Users className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const unreadCount = alerts.filter(alert => !alert.is_read).length;
  const criticalCount = alerts.filter(alert => alert.severity === 'critical' && !alert.is_read).length;

  if (loading) {
    return (
      <Card className={cn(
        "rounded-2xl shadow-lg border backdrop-blur-xl",
        isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
      )}>
        <CardContent className="p-6">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "rounded-2xl shadow-lg border backdrop-blur-xl",
      isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
    )}>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h3 className={cn("text-lg font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
              System Alerts
            </h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs font-bold">
                {unreadCount}
              </span>
            )}
            {criticalCount > 0 && (
              <span className="bg-red-600 text-white rounded-full px-2 py-1 text-xs font-bold animate-pulse">
                {criticalCount} Critical
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button
                size="sm"
                onClick={markAllAsRead}
                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 border border-blue-500/30 rounded-lg px-3 py-1 text-xs"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Mark All Read
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs",
                isDarkMode
                  ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  : "bg-white/30 hover:bg-white/40 text-gray-900 border border-white/40"
              )}
            >
              {showAll ? 'Show Less' : 'Show All'}
            </Button>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className={cn("w-12 h-12 mx-auto mb-3", isDarkMode ? "text-gray-400" : "text-gray-500")} />
            <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
              No alerts at this time
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  getSeverityColor(alert.severity),
                  !alert.is_read && "ring-2 ring-blue-500/20"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(alert.severity)}
                      {getAlertTypeIcon(alert.type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={cn(
                          "font-semibold text-sm",
                          isDarkMode ? "text-white" : "text-gray-900"
                        )}>
                          {alert.title}
                        </h4>
                        {!alert.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </div>

                      <p className={cn(
                        "text-sm mb-2",
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      )}>
                        {alert.message}
                      </p>

                      <div className="flex items-center gap-4 text-xs">
                        <span className={cn(
                          "capitalize px-2 py-1 rounded-lg font-semibold",
                          alert.severity === 'critical' ? "bg-red-500/20 text-red-600" :
                            alert.severity === 'error' ? "bg-red-400/20 text-red-500" :
                              alert.severity === 'warning' ? "bg-yellow-500/20 text-yellow-600" :
                                "bg-blue-500/20 text-blue-600"
                        )}>
                          {alert.severity}
                        </span>

                        <span className={cn("", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                          {new Date(alert.created_at).toLocaleString()}
                        </span>

                        {alert.expires_at && (
                          <span className={cn("", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                            Expires: {new Date(alert.expires_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!alert.is_read && (
                      <Button
                        size="sm"
                        onClick={() => markAsRead(alert.id)}
                        className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 border border-blue-500/30 rounded-lg p-1"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => dismissAlert(alert.id)}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-600 border border-red-500/30 rounded-lg p-1"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}