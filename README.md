# PDF Annotate Tool

A browser-based PDF annotation tool built with Next.js.  
You can upload a PDF, draw, highlight, add shapes, comments, and text, then export your annotated PDF.

---

## 🚀 Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pratham216/pdf-annotate-tool.git
   cd pdf-annotate-tool
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000)

---

## 📝 How This Project Works

- **Upload a PDF:**  
  Use the "Upload PDF" button on the homepage or editor toolbar. The file is loaded in the browser (no server upload).

- **Annotate:**  
  Use the toolbar to select tools: Draw, Line, Rectangle, Circle, Arrow, Highlight, Comment, or Text.  
  Draw or click on the PDF to add annotations.  
  Comments and text can be edited in popups.

- **Undo/Redo/Clear:**  
  Use the toolbar buttons to undo, redo, or clear annotations on the current page.

- **Page Navigation & Zoom:**  
  Navigate between PDF pages and zoom in/out using the toolbar.

- **Save:**  
  Click "Save" to export your annotated PDF.  
  All annotations are rendered onto the PDF pages and downloaded as a new PDF.

---

## 🛠️ Tech Stack

- [Next.js](https://nextjs.org/) (App Router)
- [pdfjs-dist](https://github.com/mozilla/pdf.js) for PDF rendering
- [jsPDF](https://github.com/parallax/jsPDF) for PDF export
- React hooks for state management

---

## 📦 Deployment

You can deploy this project on [Vercel](https://vercel.com/) or any platform that supports Next.js.

---

## 📄 License

MIT

---

**Enjoy annotating your PDFs!**