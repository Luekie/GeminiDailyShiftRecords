import { supabase } from './supabase';

export const fetchShiftsForDate = async (selectedDate: string) => {
  const date = new Date(selectedDate);
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);

  const formattedDate = date.toISOString().slice(0, 10);
  const formattedPrevDate = previousDate.toISOString().slice(0, 10);

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
