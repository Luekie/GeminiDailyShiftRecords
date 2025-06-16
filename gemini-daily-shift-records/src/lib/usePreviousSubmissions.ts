import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const usePreviousSubmissions = (date: string) => {
  return useQuery({
    queryKey: ["previousSubmissions", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, attendant:attendant_id(username)")
        .eq("shift_date", date)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!date,
  });
};
