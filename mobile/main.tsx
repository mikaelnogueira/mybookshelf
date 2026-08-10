import { createRoot } from "react-dom/client";
import { BookshelfApp } from "../app/BookshelfApp";
import "../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("MyBookshelf não encontrou o elemento principal.");

createRoot(root).render(<BookshelfApp />);
