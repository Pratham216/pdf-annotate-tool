'use client'
import PdfViewer from '../components/PdfViewer'
import Header from '../components/Header'

export default function EditorPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <PdfViewer />
      </main>
    </div>
  )
}