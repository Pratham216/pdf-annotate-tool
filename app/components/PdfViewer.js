'use client'
import { useState, useRef, useEffect } from 'react'
import '@react-pdf-viewer/core/lib/styles/index.css'
import jsPDF from 'jspdf' // Make sure you have installed jspdf: npm install jspdf

const TOOLS = {
    DRAW: 'draw',
    LINE: 'line',
    RECT: 'rect',
    CIRCLE: 'circle',
    ARROW: 'arrow',
    HIGHLIGHT: 'highlight',
    COMMENT: 'comment',
    TEXT: 'text',
    NONE: 'none',
}

export default function PdfViewer() {
    const [pdfFile, setPdfFile] = useState(null)
    const pdfCanvasRef = useRef(null)
    const annotationCanvasRef = useRef(null)
    const renderTaskRef = useRef(null) // To track PDF.js render task
    const [scale, setScale] = useState(1.0) // Adjusted default zoom to 100%
    const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 })
    const [activeTool, setActiveTool] = useState(TOOLS.DRAW)
    const [color, setColor] = useState('#FF0000') // Main color for drawing, shapes, text stroke
    const [lineThickness, setLineThickness] = useState(2)
    const [fontSize, setFontSize] = useState(16)
    const [drawing, setDrawing] = useState(false)
    const [startPoint, setStartPoint] = useState(null)
    const [shapes, setShapes] = useState([]) // Current page annotations
    const [tempShape, setTempShape] = useState(null) // For previewing shape while dragging
    const [undoStack, setUndoStack] = useState([])
    const [redoStack, setRedoStack] = useState([])
    const [commentPopup, setCommentPopup] = useState(null) // {x, y, index}
    const [commentText, setCommentText] = useState('')
    const [textEdit, setTextEdit] = useState({ index: null, value: '' })
    const [currentPage, setCurrentPage] = useState(1)
    const [numPages, setNumPages] = useState(1)
    const [savingPdf, setSavingPdf] = useState(false)

    // Store annotations per page (simple in-memory, can be extended to IndexedDB/backend)
    const [pageAnnotations, setPageAnnotations] = useState({})

    // Check for uploaded PDF from session storage on component mount
    useEffect(() => {
        const uploadedPdfUrl = sessionStorage.getItem('uploadedPdfUrl');
        if (uploadedPdfUrl) {
            setPdfFile(uploadedPdfUrl);
            sessionStorage.removeItem('uploadedPdfUrl'); // Clean up session storage
        }
    }, []); // Run only once on mount

    // Handle PDF upload and initial rendering
    const handleFileChange = async (e) => {
        const file = e.target.files[0]
        if (file && file.type === 'application/pdf') {
            console.log('PDF file selected:', file.name); // Debug log
            const fileUrl = URL.createObjectURL(file)
            setPdfFile(fileUrl)
            setCurrentPage(1)
            setPageAnnotations({}) // Clear all annotations for new PDF
            setShapes([]) // Clear current page shapes
        }
    }

    const renderPdf = async (url, pageNum, scaleVal) => {
        console.log(`Attempting to render PDF page ${pageNum} at scale ${scaleVal}`); // Debug log
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

        try {
            const pdf = await pdfjsLib.getDocument(url).promise
            console.log('PDF document loaded successfully.'); // Debug log
            setNumPages(pdf.numPages)
            const page = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale: scaleVal })

            // Set PDF canvas dimensions
            if (pdfCanvasRef.current) { // Check if ref is available
                pdfCanvasRef.current.width = viewport.width
                pdfCanvasRef.current.height = viewport.height
            } else {
                console.error('pdfCanvasRef.current is null during render.');
            }
            setPdfDimensions({ width: viewport.width, height: viewport.height })

            const renderContext = {
                canvasContext: pdfCanvasRef.current?.getContext('2d'), // Use optional chaining
                viewport: viewport
            }

            if (!renderContext.canvasContext) {
                console.error('Canvas context not available for rendering.');
                return;
            }

            // Cancel previous render if still running to prevent "Cannot use the same canvas" error
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }

            // Start new render and track it
            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            await renderTask.promise;
            console.log('PDF page rendered successfully.'); // Debug log
            renderTaskRef.current = null; // Clear task when complete
        } catch (err) {
            // Ignore cancellation errors
            if (err.name === 'RenderingCancelledException') {
                console.warn('PDF rendering cancelled.');
                return;
            }
            console.error('Error during PDF loading or rendering:', err); // Catch and log all errors
        }
    }

    // Re-render PDF when file, page, or scale changes
    useEffect(() => {
        if (pdfFile) {
            renderPdf(pdfFile, currentPage, scale)
        }
    }, [pdfFile, currentPage, scale])

    // Load annotations for current page when page changes
    useEffect(() => {
        setShapes(pageAnnotations[currentPage] || [])
        setUndoStack([]) // Reset undo/redo when page changes
        setRedoStack([])
    }, [currentPage, pageAnnotations]) // Depend on pageAnnotations to re-load if they change externally (e.g., file load)

    // Drawing logic for annotation canvas
    useEffect(() => {
        const canvas = annotationCanvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height) // Clear canvas before redrawing

        // Redraw all shapes for the current page
        shapes.forEach((shape, i) => drawShape(ctx, shape, false, i))
        
        // Draw temporary shape if any (e.g., during drag for rect/circle/line/arrow)
        if (tempShape) drawShape(ctx, tempShape, true)
    }, [shapes, pdfDimensions, tempShape, fontSize, lineThickness, color]) // Added drawing related states to dependencies

    // Helper to draw a shape (used for both persistent and temporary shapes)
    function drawShape(ctx, shape, isTemp = false) {
        ctx.save() // Save current canvas state
        ctx.setLineDash(isTemp ? [5, 5] : []) // Dashed line for temp shapes

        if (shape.type === 'highlight') {
            ctx.globalAlpha = 0.4
            ctx.fillStyle = shape.color || '#FFFF00' // Use shape's color or default yellow
            ctx.strokeStyle = shape.color || '#FFFF00'
            ctx.lineWidth = shape.lineThickness || 2
            const { x1, y1, x2, y2 } = shape
            ctx.fillRect(
                Math.min(x1, x2),
                Math.min(y1, y2),
                Math.abs(x2 - x1),
                Math.abs(y2 - y1)
            )
            ctx.globalAlpha = 1.0 // Reset alpha
        } else if (shape.type === 'comment') {
            ctx.beginPath()
            ctx.arc(shape.x, shape.y, 12, 0, 2 * Math.PI)
            ctx.fillStyle = '#FFD700' // Gold color for comment icon
            ctx.fill()
            ctx.strokeStyle = '#333'
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.fillStyle = '#333'
            ctx.font = `bold ${shape.fontSize || fontSize}px sans-serif` // Use shape's font size or current
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('C', shape.x, shape.y)
        } else if (shape.type === 'text') {
            ctx.font = `${shape.fontSize || fontSize}px sans-serif` // Use shape's font size or current
            ctx.fillStyle = shape.color || color // Use shape's color or current
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            ctx.fillText(shape.text || '', shape.x, shape.y)
        } else if (shape.type === 'line') {
            ctx.strokeStyle = shape.color || color // Use shape's color or current
            ctx.lineWidth = shape.lineThickness || lineThickness // Use shape's thickness or current
            ctx.beginPath()
            ctx.moveTo(shape.x1, shape.y1)
            ctx.lineTo(shape.x2, shape.y2)
            ctx.stroke()
        } else { // DRAW, RECT, CIRCLE, ARROW
            ctx.strokeStyle = shape.color || color // Use shape's color or current
            ctx.lineWidth = shape.lineThickness || lineThickness // Use shape's thickness or current
            if (shape.type === 'draw') {
                ctx.beginPath()
                shape.points.forEach((pt, i) => {
                    if (i === 0) ctx.moveTo(pt.x, pt.y)
                    else ctx.lineTo(pt.x, pt.y)
                })
                ctx.stroke()
            } else if (shape.type === 'rect') {
                const { x1, y1, x2, y2 } = shape
                ctx.strokeRect(
                    Math.min(x1, x2),
                    Math.min(y1, y2),
                    Math.abs(x2 - x1),
                    Math.abs(y2 - y1)
                )
            } else if (shape.type === 'circle') {
                const { x1, y1, x2, y2 } = shape
                const cx = (x1 + x2) / 2
                const cy = (y1 + y2) / 2
                const rx = Math.abs(x2 - x1) / 2
                const ry = Math.abs(y2 - y1) / 2
                ctx.beginPath()
                ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
                ctx.stroke()
            } else if (shape.type === 'arrow') {
                const { x1, y1, x2, y2 } = shape
                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.stroke()
                const angle = Math.atan2(y2 - y1, x2 - x1)
                const headlen = 15
                ctx.beginPath()
                ctx.moveTo(x2, y2)
                ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6))
                ctx.moveTo(x2, y2)
                ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6))
                ctx.stroke()
            }
        }
        ctx.restore() // Restore canvas state
    }

    // Mouse events for drawing and shapes
    const handleMouseDown = (e) => {
        const rect = annotationCanvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        // Always check if clicking on a comment icon first
        const clickedCommentIdx = shapes.findIndex(
            s => s.type === 'comment' && Math.hypot(s.x - x, s.y - y) < 14
        )
        if (clickedCommentIdx !== -1) {
            setCommentPopup({ x: shapes[clickedCommentIdx].x, y: shapes[clickedCommentIdx].y, index: clickedCommentIdx })
            setCommentText(shapes[clickedCommentIdx].text || '')
            return // Prevent further action if a comment icon was clicked
        }

        // Check if clicking on a text annotation
        const clickedTextIdx = shapes.findIndex(
            s => s.type === 'text' &&
                x >= s.x && x <= s.x + 200 && y >= s.y && y <= s.y + (s.fontSize || fontSize) // Approximate text box size
        )
        if (clickedTextIdx !== -1) {
            setTextEdit({ index: clickedTextIdx, value: shapes[clickedTextIdx].text })
            return // Prevent further action if a text annotation was clicked
        }

        if (activeTool === TOOLS.DRAW) {
            pushUndo()
            setDrawing(true)
            setShapes(prev => [...prev, { type: 'draw', points: [{ x, y }], color, lineThickness }])
        } else if (activeTool === TOOLS.LINE) {
            pushUndo()
            setDrawing(true)
            setStartPoint({ x, y })
            setTempShape({ type: 'line', x1: x, y1: y, x2: x, y2: y, color, lineThickness })
        } else if ([TOOLS.RECT, TOOLS.CIRCLE, TOOLS.ARROW, TOOLS.HIGHLIGHT].includes(activeTool)) {
            pushUndo()
            setDrawing(true)
            setStartPoint({ x, y })
            setTempShape({ type: activeTool, x1: x, y1: y, x2: x, y2: y, color: activeTool === TOOLS.HIGHLIGHT ? '#FFFF00' : color, lineThickness })
        } else if (activeTool === TOOLS.COMMENT) {
            pushUndo()
            // Place a new comment icon and open popup
            setShapes(prev => [...prev, { type: 'comment', x, y, text: '', fontSize }])
            setCommentPopup({ x, y, index: shapes.length }) // New comment index is shapes.length before setState updates
            setCommentText('')
        } else if (activeTool === TOOLS.TEXT) {
            pushUndo()
            // Place a new text annotation
            setShapes(prev => [...prev, { type: 'text', x, y, text: 'Click to edit', color, fontSize }])
        }
    }

    const handleMouseMove = (e) => {
        const rect = annotationCanvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        if (activeTool === TOOLS.DRAW && drawing) {
            setShapes(prev => {
                const last = prev[prev.length - 1]
                if (!last || last.type !== 'draw') return prev
                const updated = { ...last, points: [...last.points, { x, y }] }
                return [...prev.slice(0, -1), updated]
            })
        } else if (activeTool === TOOLS.LINE && drawing && startPoint) {
            setTempShape({ type: 'line', x1: startPoint.x, y1: startPoint.y, x2: x, y2: y, color, lineThickness })
        } else if ([TOOLS.RECT, TOOLS.CIRCLE, TOOLS.ARROW, TOOLS.HIGHLIGHT].includes(activeTool) && drawing && startPoint) {
            setTempShape({ type: activeTool, x1: startPoint.x, y1: startPoint.y, x2: x, y2: y, color: activeTool === TOOLS.HIGHLIGHT ? '#FFFF00' : color, lineThickness })
        }
    }

    const handleMouseUp = () => {
        if (activeTool === TOOLS.DRAW) {
            setDrawing(false)
        } else if (activeTool === TOOLS.LINE && drawing && tempShape) {
            setShapes(prev => [...prev, tempShape])
            setDrawing(false)
            setStartPoint(null)
            setTempShape(null)
        } else if ([TOOLS.RECT, TOOLS.CIRCLE, TOOLS.ARROW, TOOLS.HIGHLIGHT].includes(activeTool) && drawing && tempShape) {
            setShapes(prev => [...prev, tempShape])
            setDrawing(false)
            setStartPoint(null)
            setTempShape(null)
        }
    }

    // Comment popup save/cancel
    const handleCommentSave = () => {
        if (commentPopup && commentPopup.index != null) {
            setShapes(prev => prev.map((s, i) => i === commentPopup.index ? { ...s, text: commentText } : s))
        }
        setCommentPopup(null)
        setCommentText('')
    }
    const handleCommentCancel = () => {
        // If new comment and no text, remove it
        if (commentPopup && commentPopup.index === shapes.length - 1 && !commentText) {
            setShapes(prev => prev.slice(0, -1))
        }
        setCommentPopup(null)
        setCommentText('')
    }

    // Text edit popup save/cancel
    const handleTextEditChange = (e) => {
        setTextEdit(edit => ({ ...edit, value: e.target.value }))
    }
    const handleTextEditSave = () => {
        setShapes(prev => prev.map((s, i) => i === textEdit.index ? { ...s, text: textEdit.value } : s))
        setTextEdit({ index: null, value: '' })
    }
    const handleTextEditCancel = () => {
        // If new text and no text, remove it (optional, could leave empty text box)
        if (textEdit && textEdit.index === shapes.length - 1 && textEdit.value === 'Click to edit') {
             setShapes(prev => prev.slice(0, -1));
        }
        setTextEdit({ index: null, value: '' })
    }

    // Undo/Redo logic
    const pushUndo = () => {
        setUndoStack(prev => [...prev, shapes])
        setRedoStack([]) // Clear redo stack on new action
    }
    const handleUndo = () => {
        setUndoStack(prev => {
            if (prev.length === 0) return prev
            setRedoStack(r => [shapes, ...r])
            setShapes(prev[prev.length - 1])
            return prev.slice(0, -1)
        })
    }
    const handleRedo = () => {
        setRedoStack(prev => {
            if (prev.length === 0) return prev
            setUndoStack(u => [...u, shapes])
            setShapes(prev[0])
            return prev.slice(1)
        })
    }

    // Clear all annotations on the current page
    const handleClear = () => {
        pushUndo() // Save current state for undo
        setShapes([])
    }

    // Save all annotated pages as a single PDF
    const handleSave = async () => {
        if (!pdfFile || !pdfCanvasRef.current || !annotationCanvasRef.current) return;
        setSavingPdf(true); // Start loading state

        // Create a consolidated annotations object including the current page's shapes
        const allAnnotationsToSave = {
            ...pageAnnotations,
            [currentPage]: shapes
        };

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const originalPdf = await pdfjsLib.getDocument(pdfFile).promise;
        
        // Initialize jsPDF with dimensions of the first page to set overall format
        // We will add pages with the same format as needed
        const firstPage = await originalPdf.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: scale });

        const doc = new jsPDF({
            orientation: firstViewport.width > firstViewport.height ? 'l' : 'p',
            unit: 'pt',
            format: [firstViewport.width, firstViewport.height]
        });

        for (let i = 1; i <= numPages; i++) {
            // Add a new page to the PDF if it's not the first page
            if (i > 1) {
                doc.addPage([firstViewport.width, firstViewport.height], firstViewport.width > firstViewport.height ? 'l' : 'p');
            }

            const page = await originalPdf.getPage(i);
            const viewport = page.getViewport({ scale: scale });

            // Create a temporary canvas for PDF content
            const pdfPageCanvas = document.createElement('canvas');
            const pdfPageCtx = pdfPageCanvas.getContext('2d');
            pdfPageCanvas.width = viewport.width;
            pdfPageCanvas.height = viewport.height;

            const renderContext = {
                canvasContext: pdfPageCtx,
                viewport: viewport
            };
            await page.render(renderContext).promise;

            // Create a temporary canvas for annotations of this page
            const annotationPageCanvas = document.createElement('canvas');
            const annotationPageCtx = annotationPageCanvas.getContext('2d');
            annotationPageCanvas.width = viewport.width;
            annotationPageCanvas.height = viewport.height;

            // Draw annotations for the current page from the consolidated annotations object
            const currentPageShapes = allAnnotationsToSave[i] || [];
            currentPageShapes.forEach(shape => drawShape(annotationPageCtx, shape));

            // Combine PDF page and annotations onto a final canvas
            const combinedCanvas = document.createElement('canvas');
            const combinedCtx = combinedCanvas.getContext('2d');
            combinedCanvas.width = viewport.width;
            combinedCanvas.height = viewport.height;

            combinedCtx.drawImage(pdfPageCanvas, 0, 0); // Draw PDF content first
            combinedCtx.drawImage(annotationPageCanvas, 0, 0); // Then draw annotations on top

            // Convert combined canvas to image data URL and add to PDF
            const imgData = combinedCanvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 0, 0, viewport.width, viewport.height);
        }

        doc.save('annotated-document.pdf');
        setSavingPdf(false); // End loading state
    };

    // Save shapes to pageAnnotations when the page changes (to persist annotations)
    const handlePageChange = (newPage) => {
        // Save current page's shapes before switching
        setPageAnnotations(prev => ({ ...prev, [currentPage]: shapes }));
        setCurrentPage(newPage);
    };

    // Handle click outside PDF/annotation area to reset active tool and close popups
    const handleOuterClick = () => {
        setActiveTool(TOOLS.NONE) // Reset active tool
        setDrawing(false)
        setStartPoint(null)
        setTempShape(null)
        setCommentPopup(null) // Close comment popup
        setCommentText('')
        setTextEdit({ index: null, value: '' }) // Close text edit popup
    }

    return (
        <div className="flex flex-col h-full" onClick={handleOuterClick}>
            {/* Toolbar */}
            <div className="bg-gray-100 p-2 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                />
                <label
                    htmlFor="pdf-upload"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                >
                    Upload PDF
                </label>
                <button className={`px-3 py-1 rounded cursor-pointer ${activeTool === TOOLS.DRAW ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.DRAW)}>Draw</button>
                <button className={`px-3 py-1 rounded cursor-pointer ${activeTool === TOOLS.LINE ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.LINE)}>Line</button>
                <button className={`px-3 py-1 rounded cursor-pointer ${activeTool === TOOLS.RECT ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.RECT)}>Rectangle</button>
                <button className={`px-3 py-1 rounded cursor-pointer ${activeTool === TOOLS.CIRCLE ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.CIRCLE)}>Circle</button>
                <button className={`px-3 py-1 rounded cursor-pointer ${activeTool === TOOLS.ARROW ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.ARROW)}>Arrow</button>
                <button className={`px-3 py-1 rounded cursor-pointer ${activeTool === TOOLS.HIGHLIGHT ? 'bg-yellow-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.HIGHLIGHT)}>Highlight</button>
                <button className={`px-3 py-1 rounded cursor-pointer ${activeTool === TOOLS.COMMENT ? 'bg-green-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.COMMENT)}>Comment</button>
                <button className={`px-3 py-1 rounded cursor-pointer ${activeTool === TOOLS.TEXT ? 'bg-purple-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.TEXT)}>Text</button>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="ml-2 w-8 h-8 p-0 border-0" title="Pick color" />
                <div className="flex items-center gap-2 ml-2">
                    <label className="text-xs">Line</label>
                    <input type="range" min="1" max="10" value={lineThickness} onChange={e => setLineThickness(Number(e.target.value))} className="w-20" title="Line thickness" />
                    <span className="text-xs">{lineThickness}px</span>
                </div>
                <div className="flex items-center gap-2 ml-2">
                    <label className="text-xs">Font</label>
                    <input type="number" min="8" max="48" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-14 px-1 border rounded" title="Font size" />
                    <span className="text-xs">px</span>
                </div>
                <button className="px-3 py-1 rounded bg-gray-200 ml-2 cursor-pointer " onClick={handleClear}>Clear</button>
                <button className="px-3 py-1 rounded bg-gray-200 ml-2 cursor-pointer " onClick={handleUndo} disabled={undoStack.length === 0}>Undo</button>
                <button className="px-3 py-1 rounded bg-gray-200 ml-2 cursor-pointer " onClick={handleRedo} disabled={redoStack.length === 0}>Redo</button>
                    <button
                    className={`px-3 py-1 rounded bg-green-600 text-white ml-2 ${savingPdf ? 'cursor-not-allowed opacity-70' : 'hover:bg-green-700 cursor-pointer'}`}
                    onClick={handleSave}
                    disabled={!pdfFile || savingPdf}
                >
                    {savingPdf ? 'Saving...' : 'Save'}
                </button>
                <div className="flex items-center gap-2 ml-2">
                    <button className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
                    <span>Page {currentPage} / {numPages}</span>
                    <button className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === numPages}>Next</button>
                    <button className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer" onClick={() => setScale(s => Math.max(0.5, s - 0.25))}>-</button>
                    <span>Zoom: {(scale * 100).toFixed(0)}%</span>
                    <button className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer" onClick={() => setScale(s => Math.min(4, s + 0.25))}>+</button>
                </div>
            </div>
            {/* PDF Viewer Area */}
            <div className="flex-grow relative overflow-auto" style={{ height: 'calc(100vh - 60px)' }}>
                <div className="absolute inset-0" onClick={e => e.stopPropagation()}>
                    <canvas
                        ref={pdfCanvasRef}
                        className="absolute z-0"
                        height={pdfDimensions.height}
                        width={pdfDimensions.width}
                    />
                    <canvas
                        ref={annotationCanvasRef}
                        className="absolute z-10 top-0 left-0 pointer-events-auto"
                        height={pdfDimensions.height}
                        width={pdfDimensions.width}
                        style={{ pointerEvents: pdfFile ? 'auto' : 'none' }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                    />
                    {/* Comment popup */}
                    {commentPopup && (
                        <div
                            style={{
                                position: 'absolute',
                                left: commentPopup.x + 20,
                                top: commentPopup.y,
                                zIndex: 50,
                                background: 'white',
                                border: '1px solid #ccc',
                                borderRadius: 8,
                                padding: 12,
                                minWidth: 180,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}
                            onClick={e => e.stopPropagation()} // Prevent outer click from closing this
                        >
                            <textarea
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                rows={3}
                                className="w-full border rounded p-1 mb-2"
                                placeholder="Type your comment..."
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button className="px-2 py-1 bg-blue-500 text-white rounded" onClick={handleCommentSave}>Save</button>
                                <button className="px-2 py-1 bg-gray-300 rounded" onClick={handleCommentCancel}>Cancel</button>
                            </div>
                        </div>
                    )}
                    {/* Text edit popup */}
                    {textEdit.index !== null && shapes[textEdit.index] && (
                        <div
                            style={{
                                position: 'absolute',
                                left: shapes[textEdit.index].x + 20,
                                top: shapes[textEdit.index].y,
                                zIndex: 50,
                                background: 'white',
                                border: '1px solid #ccc',
                                borderRadius: 8,
                                padding: 12,
                                minWidth: 180,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}
                            onClick={e => e.stopPropagation()} // Prevent outer click from closing this
                        >
                            <textarea
                                value={textEdit.value}
                                onChange={handleTextEditChange}
                                rows={2}
                                className="w-full border rounded p-1 mb-2"
                                placeholder="Edit text..."
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button className="px-2 py-1 bg-blue-500 text-white rounded" onClick={handleTextEditSave}>Save</button>
                                <button className="px-2 py-1 bg-gray-300 rounded" onClick={handleTextEditCancel}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
                {!pdfFile && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                            <p className="text-gray-500">Upload a PDF to start annotating</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}