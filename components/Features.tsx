"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { FeatureId } from "@/lib/featureList";

// The reader's optional features (Settings → Optional features), loaded with
// the page by the root layout so hidden fields never flash up first.

const FeaturesContext = createContext<{
  features: FeatureId[];
  setFeatures: (features: FeatureId[]) => void;
}>({ features: [], setFeatures: () => {} });

export function FeaturesProvider({ initial, children }: { initial: FeatureId[]; children: ReactNode }) {
  const [features, setFeatures] = useState(initial);
  return <FeaturesContext.Provider value={{ features, setFeatures }}>{children}</FeaturesContext.Provider>;
}

export const useFeatures = () => useContext(FeaturesContext);

export const useFeature = (id: FeatureId) => useContext(FeaturesContext).features.includes(id);
