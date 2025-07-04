import Link from 'next/link'

export default function Hero() {
  return (
    <section className="bg-blue-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            Annotate PDFs with Ease
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-600">
            Mark up, highlight, and comment on PDF documents directly in your browser. No installation required.
          </p>
          <div className="mt-10">
            <Link
              href="/editor"
              className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
            >
              Start Annotating
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}