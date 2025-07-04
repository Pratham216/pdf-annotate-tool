'use client'
import { useState, useRef, useEffect } from 'react'
import '@react-pdf-viewer/core/lib/styles/index.css'

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
    const [scale, setScale] = useState(1.5)
    const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 })
    const [activeTool, setActiveTool] = useState(TOOLS.DRAW)
    const [color, setColor] = useState('#FF0000')
    const [lineThickness, setLineThickness] = useState(2)
    const [fontSize, setFontSize] = useState(16)
    const [drawing, setDrawing] = useState(false)
    const [startPoint, setStartPoint] = useState(null)
    const [shapes, setShapes] = useState([])
    const [tempShape, setTempShape] = useState(null)
    const [undoStack, setUndoStack] = useState([])
    const [redoStack, setRedoStack] = useState([])
    const [commentPopup, setCommentPopup] = useState(null)
    const [commentText, setCommentText] = useState('')
    const [textEdit, setTextEdit] = useState({ index: null, value: '' })

    // Handle PDF upload and rendering
    const handleFileChange = async (e) => {
        const file = e.target.files[0]
        if (file && file.type === 'application/pdf') {
            const fileUrl = URL.createObjectURL(file)
            setPdfFile(fileUrl)
            await renderPdf(fileUrl)
        }
    }

    const renderPdf = async (url) => {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

        const pdf = await pdfjsLib.getDocument(url).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: scale })

        pdfCanvasRef.current.width = viewport.width
        pdfCanvasRef.current.height = viewport.height
        setPdfDimensions({ width: viewport.width, height: viewport.height })

        const renderContext = {
            canvasContext: pdfCanvasRef.current.getContext('2d'),
            viewport: viewport
        }
        await page.render(renderContext).promise
    }

    useEffect(() => {
        const canvas = annotationCanvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        shapes.forEach((shape, i) => drawShape(ctx, shape, false, i))
        if (tempShape) drawShape(ctx, tempShape, true)
    }, [shapes, pdfDimensions, tempShape])

    function drawShape(ctx, shape, isTemp = false, idx = null) {
        ctx.save()
        if (shape.type === 'highlight') {
            ctx.globalAlpha = 0.4
            ctx.fillStyle = shape.color || '#FFFF00'
            ctx.strokeStyle = shape.color || '#FFFF00'
            ctx.lineWidth = shape.lineThickness || 2
            ctx.setLineDash(isTemp ? [5, 5] : [])
            const { x1, y1, x2, y2 } = shape
            ctx.fillRect(
                Math.min(x1, x2),
                Math.min(y1, y2),
                Math.abs(x2 - x1),
                Math.abs(y2 - y1)
            )
            ctx.globalAlpha = 1.0
        } else if (shape.type === 'comment') {
            ctx.beginPath()
            ctx.arc(shape.x, shape.y, 12, 0, 2 * Math.PI)
            ctx.fillStyle = '#FFD700'
            ctx.fill()
            ctx.strokeStyle = '#333'
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.fillStyle = '#333'
            ctx.font = `bold ${fontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('C', shape.x, shape.y)
        } else if (shape.type === 'text') {
            ctx.font = `${shape.fontSize || fontSize}px sans-serif`
            ctx.fillStyle = shape.color || color
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            ctx.fillText(shape.text || '', shape.x, shape.y)
        } else if (shape.type === 'line') {
            ctx.strokeStyle = shape.color || color
            ctx.lineWidth = shape.lineThickness || lineThickness
            ctx.setLineDash(isTemp ? [5, 5] : [])
            ctx.beginPath()
            ctx.moveTo(shape.x1, shape.y1)
            ctx.lineTo(shape.x2, shape.y2)
            ctx.stroke()
        } else {
            ctx.strokeStyle = shape.color || color
            ctx.lineWidth = shape.lineThickness || lineThickness
            ctx.setLineDash(isTemp ? [5, 5] : [])
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
        ctx.restore()
    }

    const handleMouseDown = (e) => {
        const rect = annotationCanvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        // Check if clicking on a comment icon first
        const clickedCommentIdx = shapes.findIndex(
            s => s.type === 'comment' && Math.hypot(s.x - x, s.y - y) < 14
        )
        if (clickedCommentIdx !== -1) {
            setCommentPopup({ x: shapes[clickedCommentIdx].x, y: shapes[clickedCommentIdx].y, index: clickedCommentIdx })
            setCommentText(shapes[clickedCommentIdx].text || '')
            return
        }
        // Check if clicking on a text annotation
        const clickedTextIdx = shapes.findIndex(
            s => s.type === 'text' &&
                x >= s.x && x <= s.x + 200 && y >= s.y && y <= s.y + (s.fontSize || fontSize)
        )
        if (clickedTextIdx !== -1) {
            setTextEdit({ index: clickedTextIdx, value: shapes[clickedTextIdx].text })
            return
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
            setShapes(prev => [...prev, { type: 'comment', x, y, text: '', fontSize }])
            setCommentPopup({ x, y, index: shapes.length })
            setCommentText('')
        } else if (activeTool === TOOLS.TEXT) {
            pushUndo()
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
    const handleMouseUp = (e) => {
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

    // Undo/Redo logic
    const pushUndo = () => {
        setUndoStack(prev => [...prev, shapes])
        setRedoStack([])
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

    // Clear all annotations
    const handleClear = () => {
        pushUndo()
        setShapes([])
    }

    // Save/download annotated PDF as image
    const handleSave = () => {
        if (!pdfCanvasRef.current || !annotationCanvasRef.current) return
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = pdfCanvasRef.current.width
        tempCanvas.height = pdfCanvasRef.current.height
        const ctx = tempCanvas.getContext('2d')
        ctx.drawImage(pdfCanvasRef.current, 0, 0)
        ctx.drawImage(annotationCanvasRef.current, 0, 0)
        tempCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'annotated-pdf.png'
            link.click()
            URL.revokeObjectURL(url)
        }, 'image/png')
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="bg-gray-100 p-2 flex flex-wrap items-center gap-2">
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
                <button className={`px-3 py-1 rounded ${activeTool === TOOLS.DRAW ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.DRAW)}>Draw</button>
                <button className={`px-3 py-1 rounded ${activeTool === TOOLS.LINE ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.LINE)}>Line</button>
                <button className={`px-3 py-1 rounded ${activeTool === TOOLS.RECT ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.RECT)}>Rectangle</button>
                <button className={`px-3 py-1 rounded ${activeTool === TOOLS.CIRCLE ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.CIRCLE)}>Circle</button>
                <button className={`px-3 py-1 rounded ${activeTool === TOOLS.ARROW ? 'bg-blue-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.ARROW)}>Arrow</button>
                <button className={`px-3 py-1 rounded ${activeTool === TOOLS.HIGHLIGHT ? 'bg-yellow-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.HIGHLIGHT)}>Highlight</button>
                <button className={`px-3 py-1 rounded ${activeTool === TOOLS.COMMENT ? 'bg-green-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.COMMENT)}>Comment</button>
                <button className={`px-3 py-1 rounded ${activeTool === TOOLS.TEXT ? 'bg-purple-200' : 'bg-white'}`} onClick={() => setActiveTool(TOOLS.TEXT)}>Text</button>
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
                <button className="px-3 py-1 rounded bg-gray-200 ml-2" onClick={handleClear}>Clear</button>
                <button className="px-3 py-1 rounded bg-gray-200 ml-2" onClick={handleUndo} disabled={undoStack.length === 0}>Undo</button>
                <button className="px-3 py-1 rounded bg-gray-200 ml-2" onClick={handleRedo} disabled={redoStack.length === 0}>Redo</button>
                <button className="px-3 py-1 rounded bg-green-600 text-white ml-2" onClick={handleSave} disabled={!pdfFile}>Save</button>
            </div>
            {/* PDF Viewer Area */}
            <div className="flex-grow relative overflow-auto" style={{ height: 'calc(100vh - 60px)' }}>
                <div className="absolute inset-0">
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
                    {textEdit.index !== null && (
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
                        >
                            <textarea
                                value={textEdit.value}
                                onChange={e => setTextEdit(edit => ({ ...edit, value: e.target.value }))}
                                rows={2}
                                className="w-full border rounded p-1 mb-2"
                                placeholder="Edit text..."
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button className="px-2 py-1 bg-blue-500 text-white rounded" onClick={() => {
                                    setShapes(prev => prev.map((s, i) => i === textEdit.index ? { ...s, text: textEdit.value } : s))
                                    setTextEdit({ index: null, value: '' })
                                }}>Save</button>
                                <button className="px-2 py-1 bg-gray-300 rounded" onClick={() => setTextEdit({ index: null, value: '' })}>Cancel</button>
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

