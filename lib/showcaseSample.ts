import { buildShowcaseYear, type ShowcaseYear } from "./showcaseYear";
import { Book } from "./types";

// A made-up year of reading for the Showcase tab's demo, shown to readers who
// haven't finished enough books to fill their own. Last year's, so every
// month has had its chance.

const SAMPLE: [title: string, author: string, pages: number, rating: number, month: number, day: number][] = [
  ["Middlemarch", "George Eliot", 880, 5, 1, 19],
  ["The Remains of the Day", "Kazuo Ishiguro", 258, 4, 2, 7],
  ["Piranesi", "Susanna Clarke", 272, 5, 2, 26],
  ["Stoner", "John Williams", 288, 5, 3, 15],
  ["The Left Hand of Darkness", "Ursula K. Le Guin", 304, 4, 4, 9],
  ["Persuasion", "Jane Austen", 249, 4, 5, 2],
  ["A Gentleman in Moscow", "Amor Towles", 462, 4, 5, 28],
  ["Pachinko", "Min Jin Lee", 496, 5, 6, 21],
  ["The Bell Jar", "Sylvia Plath", 244, 3, 7, 11],
  ["Station Eleven", "Emily St. John Mandel", 333, 4, 8, 3],
  ["Never Let Me Go", "Kazuo Ishiguro", 288, 4, 8, 24],
  ["Beloved", "Toni Morrison", 324, 5, 9, 17],
  ["The Name of the Rose", "Umberto Eco", 536, 3, 10, 30],
  ["Klara and the Sun", "Kazuo Ishiguro", 303, 4, 11, 12],
  ["A Christmas Carol", "Charles Dickens", 104, 4, 12, 23],
];

export function sampleShowcase(today: string): ShowcaseYear {
  const year = Number(today.slice(0, 4)) - 1;
  const books: Book[] = SAMPLE.map(([title, author, pages, rating, month, day], i) => ({
    id: `sample-${i}`,
    title,
    author,
    pages,
    rating,
    status: "read",
    dateRead: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    colorIndex: (i * 5) % 12,
    addedAt: `${year}-01-01T00:00:00.000Z`,
  }));
  return buildShowcaseYear(books, [], { year, include: "read", today });
}
