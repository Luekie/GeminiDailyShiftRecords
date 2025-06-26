import { useQuery } from "@tanstack/react-query";
import { fetchShiftsForDate } from './useFetchShiftsForDate';

export function usePreviousSubmissions(date: string) {
  return useQuery({
    queryKey: ['previousSubmissions', date],
    queryFn: () => fetchShiftsForDate(date),
  });
}
