import { supabase } from './supabase';

export const fetchShiftsForDate = async (selectedDate: string) => {

  // Use local date formatting (YYYY-MM-DD) instead of UTC
  const date = new Date(selectedDate);
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);

  function formatLocalDate(d: Date) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const formattedDate = formatLocalDate(date);
  const formattedPrevDate = formatLocalDate(previousDate);

  const { data, error } = await supabase
    .from('shifts')
    .select('*, attendant:attendant_id(username)')
    .or(
      `and(shift_date.eq.${formattedDate},shift_type.eq.day),and(shift_date.eq.${formattedPrevDate},shift_type.eq.night)`
    )
    .order('shift_date', { ascending: false });

  if (error) throw error;
  return data;
};
