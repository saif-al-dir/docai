import PDFParser from 'pdf2json'

// PDF buffer → one text string per page (index = page number - 1)
export function extractPagesFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser()
    parser.on('pdfParser_dataError', (errData) =>
      reject(new Error(errData?.parserError || 'Failed to parse PDF'))
    )
    parser.on('pdfParser_dataReady', (data) => {
      const pages = data.Pages.map((page) =>
        page.Texts.map((t) => t.R.map((r) => decodeURIComponent(r.T)).join('')).join(' ')
      )
      resolve(pages)
    })
    parser.parseBuffer(buffer)
  })
}