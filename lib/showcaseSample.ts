import { buildShowcaseYear, type ShowcaseYear } from "./showcaseYear";
import { Book } from "./types";

// A made-up year of reading for the Showcase tab's demo, shown to readers who
// haven't finished enough books to fill their own. Last year's, so every
// month has had its chance, with two five-star reads. The covers are real
// ones, in public/sample-covers.

const SAMPLE: [id: string, title: string, author: string, pages: number, rating: number, month: number, day: number][] = [
  ["sapiens", "Sapiens", "Yuval Noah Harari", 498, 4, 1, 19],
  ["atomic", "Atomic Habits", "James Clear", 322, 4, 2, 7],
  ["1984", "1984", "George Orwell", 318, 5, 2, 26],
  ["silent", "The Silent Patient", "Alex Michaelides", 352, 4, 3, 15],
  ["deepwork", "Deep Work", "Cal Newport", 296, 3, 4, 9],
  ["psychology", "The Psychology of Money", "Morgan Housel", 289, 4, 5, 2],
  ["lessons", "Lessons in Chemistry", "Bonnie Garmus", 464, 4, 5, 28],
  ["crawdads", "Where the Crawdads Sing", "Delia Owens", 416, 4, 6, 21],
  ["hitchhiker", "The Hitchhiker’s Guide to the Galaxy", "Douglas Adams", 216, 4, 7, 11],
  ["factfulness", "Factfulness", "Hans Rosling", 342, 4, 8, 3],
  ["james", "James", "Percival Everett", 303, 5, 8, 24],
  ["shining", "The Shining", "Stephen King", 659, 4, 9, 17],
  ["thinking", "Thinking, Fast and Slow", "Daniel Kahneman", 512, 3, 10, 30],
  ["tomorrow", "Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin", 416, 4, 11, 12],
  ["mockingbird", "To Kill a Mockingbird", "Harper Lee", 336, 4, 12, 23],
];

export function sampleShowcase(today: string): ShowcaseYear {
  const year = Number(today.slice(0, 4)) - 1;
  const books: Book[] = SAMPLE.map(([id, title, author, pages, rating, month, day], i) => ({
    id: `sample-${id}`,
    title,
    author,
    pages,
    rating,
    status: "read",
    dateRead: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    colorIndex: (i * 5) % 12,
    coverImage: `/sample-covers/${id}.jpg`,
    addedAt: `${year}-01-01T00:00:00.000Z`,
  }));
  return buildShowcaseYear(books, { year, today });
}
