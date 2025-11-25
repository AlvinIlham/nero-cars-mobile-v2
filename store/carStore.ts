import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Car } from "@/types";

interface CarState {
  cars: Car[];
  loading: boolean;
  fetchCars: (filters?: any) => Promise<void>;
  fetchCarById: (id: string) => Promise<Car | null>;
}

export const useCarStore = create<CarState>((set) => ({
  cars: [],
  loading: false,

  fetchCars: async (filters = {}) => {
    set({ loading: true });
    try {
      console.log("=== FETCHING CARS FROM SUPABASE ===");
      console.log(
        "Supabase URL:",
        process.env.EXPO_PUBLIC_SUPABASE_URL?.substring(0, 30) + "..."
      );

      let query = supabase
        .from("cars")
        .select("*")
        .eq("is_sold", false)
        .eq("is_draft", false)
        .order("created_at", { ascending: false });

      if (filters.brand) {
        query = query.eq("brand", filters.brand);
      }
      if (filters.minPrice) {
        query = query.gte("price", filters.minPrice);
      }
      if (filters.maxPrice) {
        query = query.lte("price", filters.maxPrice);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Supabase query error:", error);
        throw error;
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} cars`);

      if (data && data.length > 0) {
        console.log("First 3 cars:");
        data.slice(0, 3).forEach((car, index) => {
          console.log(`Car ${index + 1}:`, {
            id: car.id,
            brand: car.brand,
            model: car.model,
            year: car.year,
            price: car.price,
            location: car.location,
            mileage: car.mileage,
            transmission: car.transmission,
            images_count: car.images?.length || 0,
            first_image:
              car.images?.[0]?.substring(0, 50) + "..." || "No image",
          });
        });

        // Get unique brands
        const brands = [...new Set(data.map((car) => car.brand))];
        console.log("Available brands:", brands);
      } else {
        console.log("⚠️ No cars found in database");
      }

      set({ cars: data || [] });
    } catch (error) {
      console.error("❌ Fetch cars error:", error);
      set({ cars: [] });
    } finally {
      set({ loading: false });
    }
  },

  fetchCarById: async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Fetch car error:", error);
      return null;
    }
  },
}));
