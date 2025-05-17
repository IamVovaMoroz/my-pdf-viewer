import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';


GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

type PageRenderParameters = Parameters<PDFPageProxy['render']>[0];

const PDFJSViewer = () => {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);

  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const renderAreaRef = useRef<HTMLDivElement | null>(null);

  const renderPage = async (pageNumber: number) => {
    if (!pdfDoc) return;

    const canvas = canvasRef.current;

    const textLayerDiv = textLayerRef.current;

    if (!canvas || !textLayerDiv) {
      console.error("Canvas element not found.");
      return;
    }

    try {
      const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
      const context = canvas.getContext('2d');

      if (!context) {
        console.error('Failed to get 2D context from canvas.');
        return;
      }

      const viewport: PageViewport = page.getViewport({ scale, rotation });

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      // 
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      textLayerDiv.innerHTML = '';

         const renderContext: PageRenderParameters = {
        canvasContext: context,
        viewport: viewport

        
      };

      await page.render(renderContext).promise;

      const textContent: TextContent = await page.getTextContent();

      pdfjsLib.renderTextLayer({
        textContentSource: textContent, 
        container: textLayerDiv,
        viewport: viewport,
        textDivs: [] 
      });

    } catch (error) {
      console.error("Error rendering page:", error);
      alert(`Error rendering page: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // NEW: Обработчик для события mouseup для получения выделенного текста
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      console.log('Selected text:', selection.toString());
      console.log('Selection Anchor Node:', selection.anchorNode);
      console.log('Selection Focus Node:', selection.focusNode);
      console.log('Selection Range Count:', selection.rangeCount);
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        console.log('Selection Range Bounding Rect:', range.getBoundingClientRect());
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a valid PDF file');
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    setUrlError(null);
    setIsLoadingUrl(false);

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      if (!e.target?.result) {
        alert('Error reading file');
        return;
      }
      const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
      try {

        const loadingTask = pdfjsLib.getDocument({ data: typedArray });
        const pdf: PDFDocumentProxy = await loadingTask.promise;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setPageNum(1);
        setScale(1.0);
        setRotation(0);
      } catch (error) {
        console.error('Error loading PDF:', error);
        alert(`Error loading PDF file: ${error instanceof Error ? error.message : String(error)}`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setPdfDoc(null);
        setTotalPages(0);
      }
    };
    reader.onerror = () => {
      alert('Error reading file');
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    reader.readAsArrayBuffer(file);
  };

  const loadPdfFromUrl = async (url: string) => {
    if (isLoadingUrl) return;
    setIsLoadingUrl(true);
    setUrlError(null);
    setPdfDoc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf: PDFDocumentProxy = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setPageNum(1);
      setScale(1.0);
      setRotation(0);
    } catch (err) {
      console.error('Error loading PDF from URL:', err);
      let errorMessage = 'Failed to load PDF from URL.';
      if (err instanceof Error) {
        if ('name' in err && err.name === 'MissingPDFException') {
          errorMessage = `File not found at URL: ${url}. Or CORS issue.`;
        } else if ('name' in err && err.name === 'UnexpectedResponseException') {
          errorMessage = `Unexpected server response from URL: ${url}. Check if the file exists and the server is configured correctly (CORS?).`;
        } else {
          errorMessage += ` ${err.message}`;
        }
      }
      setUrlError(errorMessage);
      setPdfDoc(null);
      setTotalPages(0);
    } finally {
      setIsLoadingUrl(false);
    }
  }

  const goToPrevPage = () => {
    if (pageNum > 1) {
      setPageNum(prevPageNum => prevPageNum - 1);
    }
  };

  const goToNextPage = () => {
    if (pageNum < totalPages) {
      setPageNum(prevPageNum => prevPageNum + 1);
    }
  };

  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3));
  };

  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.25));
  };

  const rotateClockwise = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  const rotateCounterClockwise = () => {
    setRotation(prevRotation => (prevRotation - 90 + 360) % 360);
  };

  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage(pageNum);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNum, scale, rotation]);

  //url to load a test PDF file
  const testPdfUrl = '/test.pdf';

  return (
    <div className="pdf-viewer">
      <div className="pdf-header">
        <h2>PDF Viewer</h2>
        <div className="file-controls">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            className="file-input"
            disabled={isLoadingUrl}
          />
          <button
            onClick={() => loadPdfFromUrl(testPdfUrl)}
            disabled={isLoadingUrl}
            className="load-url-button"
          >
            {isLoadingUrl ? 'Loading Test PDF...' : 'Load Test PDF (from URL)'}
          </button>
        </div>
      </div>

      {urlError && !pdfDoc && ( // Show URL error only if there is no document loaded
        <div className="placeholder error-message" style={{ color: 'red', textAlign: 'center', padding: '10px' }}>
          {urlError}
        </div>
      )}

      {pdfDoc && (
        <div className="controls-container">
          <div className="page-controls">
            <button onClick={goToPrevPage} disabled={pageNum <= 1}>
              Previous
            </button>
            <span>
              Page {pageNum} of {totalPages}
            </span>
            <button onClick={goToNextPage} disabled={pageNum >= totalPages}>
              Next
            </button>
          </div>

          <div className="zoom-controls">
            <button onClick={zoomOut} disabled={scale <= 0.25}>Zoom Out</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} disabled={scale >= 3}>Zoom In</button>
          </div>

          <div className="rotation-controls">
            <button onClick={rotateCounterClockwise}>Rotate Left</button>
            <span>{rotation}°</span>
            <button onClick={rotateClockwise}>Rotate Right</button>
          </div>
        </div>
      )}

      <div className="pdf-container" ref={renderAreaRef} onMouseUp={handleTextSelection}  >
      {pdfDoc ? (
      
      <div
      className="textLayerWrapper"
      style={{ "--scale-factor": scale } as React.CSSProperties} 
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />

      <div ref={textLayerRef} className="textLayer" />
    </div>
        ) : isLoadingUrl ? (
          <div className="placeholder">Loading from URL...</div>
        ) : urlError ? (
      
          <div className="placeholder">Failed to load PDF.</div>
        ) : (
          <div className="placeholder">Select a PDF file or click "Load Test PDF (from URL)"</div>
        )}
      </div>
    </div>
  );
};

export default PDFJSViewer;