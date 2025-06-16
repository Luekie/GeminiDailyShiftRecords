import  { useState, useEffect, type SetStateAction } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import type { AuthUser } from '../store/auth';
import { userAtom } from '../store/auth';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { useLocation } from 'wouter';

const AttendantDashboard = () => {
  const user = useAtomValue(userAtom) as AuthUser | null;
  const [shift, setShift] = useState<'day' | 'night'>('day');
  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(null); // Use string for UUID
  const [reading, setReading] = useState({ opening: 0, closing: 0 });
  const [cash, setCash] = useState(0);
  const [prepayments, setPrepayments] = useState([{ name: '', amount: 0 }]);
  const [credits, setCredits] = useState([{ name: '', amount: 0 }]);
  const [submitted, setSubmitted] = useState(false);
  const [pumps, setPumps] = useState<any[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(true);
  const [pumpError, setPumpError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Fetch pumps from Supabase
  useEffect(() => {
    const fetchPumps = async () => {
      setLoadingPumps(true);
      setPumpError(null);
      const { data, error } = await supabase.from('pumps').select('*');
      if (error) {
        setPumpError('Failed to load pumps');
        setPumps([]);
      } else {
        setPumps(data || []);
      }
      setLoadingPumps(false);
    };
    fetchPumps();
  }, []);

  const selectedPump = pumps.find(p => String(p.id) === selectedPumpId);
  const expected = selectedPump ? (reading.closing - reading.opening) * selectedPump.price : 0;

  const updateList = (
    list: { name: string; amount: number; }[],
    setList: React.Dispatch<SetStateAction<{ name: string; amount: number; }[]>>,
    index: number,
    field: 'name' | 'amount',
    value: string
  ) => {
    const updated = [...list];
    if (field === 'amount') {
      updated[index].amount = parseFloat(value);
    } else {
      updated[index].name = value;
    }
    setList(updated);
  };

  const addEntry = (list: { name: string; amount: number; }[], setList: { (value: SetStateAction<{ name: string; amount: number; }[]>): void; }) => {
    setList([...list, { name: '', amount: 0 }]);
  };

  const submitShift = useMutation({
    mutationFn: async () => {
      if (!user || !selectedPump) throw new Error('Please select a pump and fill all fields');
      const shift_date = new Date().toISOString().slice(0, 10);
      const row = {
        pump_id: selectedPump.id, // This is now a UUID
        opening_reading: reading.opening,
        closing_reading: reading.closing,
        fuel_price: selectedPump.price,
        shift_type: shift,
        shift_date,
        cash_received: cash,
        prepayments: prepayments,
        credits: credits,
        attendant_id: user.id,
      };
      const { error } = await supabase.from('shifts').insert([row]);
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      // Reset form for new entry
      setSelectedPumpId(null);
      setReading({ opening: 0, closing: 0 });
      setCash(0);
      setPrepayments([{ name: '', amount: 0 }]);
      setCredits([{ name: '', amount: 0 }]);
    },
    onError: (err: any) => {
      alert('Error submitting shift: ' + err.message);
    },
  });

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation("/");
    window.location.reload();
  };

  if (submitted) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Shift Submitted!</h2>
        <p className="mb-4">Your shift has been submitted and is awaiting supervisor approval.</p>
        <Button className="mt-4" onClick={() => setSubmitted(false)}>Submit Another Pump</Button>
      </div>
    );
  }

  if (!user) {
    setTimeout(() => setLocation("/"), 1000);
    return <div className="p-8 text-center text-red-600">You are not logged in. Redirecting to login...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold mb-2">Welcome, {user.username}!</h2>
        <Button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Log Out
        </Button>
      </div>
      <div className="flex gap-4 items-center mb-4">
        <label className="font-semibold">Select Shift:</label>
        <Select value={shift} onValueChange={val => setShift(val as 'day' | 'night')}>
          <SelectTrigger className="w-32">{shift.toUpperCase()} Shift</SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>
        <label className="font-semibold ml-8">Select Pump:</label>
        {loadingPumps ? (
          <span className="ml-2">Loading pumps...</span>
        ) : pumpError ? (
          <span className="ml-2 text-red-600">{pumpError}</span>
        ) : (
          <Select value={selectedPumpId || ""} onValueChange={val => setSelectedPumpId(val)}>
            <SelectTrigger className="w-40">{selectedPump ? selectedPump.name : "Select Pump"}</SelectTrigger>
            <SelectContent>
              {pumps.map(p => (
                <SelectItem key={String(p.id)} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {selectedPump && (
        <div className="space-y-4">
          <Button
            variant="outline"
            className="mb-2"
            onClick={() => setSelectedPumpId(null)}
          >
            ← Back to Pump Selection
          </Button>
          <Card className="bg-white/80 shadow-md">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">{selectedPump.name} ({selectedPump.type})</h3>
              <Input
                type="number"
                placeholder="Opening Meter"
                value={reading.opening}
                onChange={e => setReading(r => ({ ...r, opening: parseFloat(e.target.value) }))}
              />
              <Input
                type="number"
                placeholder="Closing Meter"
                value={reading.closing}
                onChange={e => setReading(r => ({ ...r, closing: parseFloat(e.target.value) }))}
              />
              <p>
                Expected: <strong>{expected} MWK</strong>
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 shadow-md">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">Cash Sales</h3>
              <Input
                type="number"
                value={cash}
                onChange={e => setCash(parseFloat(e.target.value))}
                placeholder="Total cash received"
              />
            </CardContent>
          </Card>
          <Card className="bg-white/80 shadow-md">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">Prepayments</h3>
              {prepayments.map((p, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Customer Name"
                    value={p.name}
                    onChange={e => updateList(prepayments, setPrepayments, idx, 'name', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={p.amount}
                    onChange={e => updateList(prepayments, setPrepayments, idx, 'amount', e.target.value)}
                  />
                </div>
              ))}
              <Button onClick={() => addEntry(prepayments, setPrepayments)}>+ Add Prepayment</Button>
              {/* Save prepayments as array in DB */}
            </CardContent>
          </Card>
          <Card className="bg-white/80 shadow-md">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">Credit Sales</h3>
              {credits.map((c, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Customer Name"
                    value={c.name}
                    onChange={e => updateList(credits, setCredits, idx, 'name', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={c.amount}
                    onChange={e => updateList(credits, setCredits, idx, 'amount', e.target.value)}
                  />
                </div>
              ))}
              <Button onClick={() => addEntry(credits, setCredits)}>+ Add Credit</Button>
              {/* Save credits as array in DB */}
            </CardContent>
          </Card>
          <div className="p-4 border rounded-lg space-y-2 bg-blue-50/80 shadow">
            <h3 className="font-semibold text-xl">Summary</h3>
            {(() => {
              // Calculate expected amount from readings and pump price
              const expected = selectedPump ? (Number(reading.closing) - Number(reading.opening)) * Number(selectedPump.price) : 0;
              // Calculate total collected
              const collected = Number(cash) + prepayments.reduce((sum, p) => sum + Number(p.amount), 0) + credits.reduce((sum, c) => sum + Number(c.amount), 0);
              // Calculate balance
              let balanceLabel = 'Balanced';
              let balanceClass = 'text-gray-800';
              if (collected < expected) {
                balanceLabel = `Shortage: ${(expected - collected).toLocaleString()}`;
                balanceClass = 'text-red-600';
              } else if (collected > expected) {
                balanceLabel = `Overage: ${(collected - expected).toLocaleString()}`;
                balanceClass = 'text-green-600';
              }
              return (
                <>
                  <p>Expected Return: <strong>{!isNaN(expected) ? expected.toLocaleString() : 0} MWK</strong></p>
                  <p>Total Collected: <strong>{!isNaN(collected) ? collected.toLocaleString() : 0} MWK</strong></p>
                  <p>
                    {collected < expected && (
                      <>
                        Balance: <strong className={cn('ml-2', balanceClass)}>{balanceLabel}</strong>
                      </>
                    )}
                    {collected > expected && (
                      <>
                        Balance: <strong className={cn('ml-2', balanceClass)}>{balanceLabel}</strong>
                      </>
                    )}
                    {collected === expected && (
                      <>
                        Balance: <strong className={cn('ml-2', balanceClass)}>{balanceLabel}</strong>
                      </>
                    )}
                  </p>
                </>
              );
            })()}
            <Button className="mt-4" onClick={() => submitShift.mutate()} disabled={submitShift.isPending}>
              {submitShift.isPending ? 'Submitting...' : 'Submit Shift'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendantDashboard;
