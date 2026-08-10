import type { Metadata } from "next";
import { BookshelfApp } from "./BookshelfApp";

export const metadata: Metadata = {
  title: "MyBookshelf — sua leitura, em um só lugar",
  description:
    "Biblioteca pessoal, progresso de leitura, anotações e estatísticas em uma experiência local-first.",
};

export default function Home() {
  return <BookshelfApp />;
}
