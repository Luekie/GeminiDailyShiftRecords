import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function usePreviousSubmissions(date: string) {
  return useQuery({
    queryKey: ["previousSubmissions", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts") // or "submissions" if that's your table
        .select("*")    // Only select flat fields, no joins!
        .eq("shift_date", date);

      if (error) throw error;
      return data ?? [];
    },
  });
}
