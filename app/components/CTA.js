export default function CTA() {
  return (
    <section className="bg-blue-600 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">Ready to get started?</h2>
          <p className="mt-4 max-w-2xl text-xl text-blue-100 mx-auto">
            Upload your PDF and start annotating in seconds
          </p>
          <div className="mt-8">
            <div className="mt-2 flex justify-center">
              <div className="relative rounded-md shadow-sm w-full max-w-md">
                <input
                  type="file"
                  accept=".pdf"
                  className="block w-full rounded-md border-0 py-3 px-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                  placeholder="Select PDF file"
                />
              </div>
            </div>
            <p className="mt-3 text-sm text-blue-200">
              Or <a href="/editor" className="font-semibold text-white hover:text-blue-100">start with a blank document</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}