// Optional features each reader can switch on in Settings. Off by default;
// switching one off only hides it: the data stays, in exports too, and comes
// back when it's switched on again. (The database side is lib/features.ts.)
export const FEATURES = [
  {
    id: "source",
    label: "Source",
    description: "Where each book came from (a book store, Kindle, the library…), with a chart on Statistics.",
  },
  {
    id: "copy",
    label: "Copy",
    description: "Whether you own a physical copy, shown in each book's details.",
  },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];

export const isFeature = (id: unknown): id is FeatureId => FEATURES.some((f) => f.id === id);
