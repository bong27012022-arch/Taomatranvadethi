import React, { useState } from 'react';
import { TabItem } from '../types';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  AlignmentType
} from "docx";

interface ExamDisplayProps {
  data: TabItem[];
}

export const ExamDisplay: React.FC<ExamDisplayProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState(data[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeContent = data.find((d) => d.id === activeTab)?.content || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopiedId(activeTab);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([activeContent], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `${activeTab}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const parseRichText = (text: string): TextRun[] => {
    // Basic parser for **bold** and *italic*
    // Split by delimiters, keeping delimiters
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    
    return parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: "Times New Roman",
          size: 26 // 13pt
        });
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return new TextRun({
          text: part.slice(1, -1),
          italics: true,
          font: "Times New Roman",
          size: 26
        });
      }
      return new TextRun({
        text: part,
        font: "Times New Roman",
        size: 26
      });
    });
  };

  const handleDownloadDoc = async () => {
    const lines = activeContent.split('\n');
    const children: (Paragraph | Table)[] = [];
    let tableBuffer: string[] = [];
    let inTable = false;

    // Helper to flush table buffer
    const processTable = () => {
      if (tableBuffer.length === 0) return;

      const rows: TableRow[] = [];
      tableBuffer.forEach((rowLine) => {
        // Remove outer pipes if present: | A | B | -> A | B
        let cleanLine = rowLine.trim();
        if (cleanLine.startsWith('|')) cleanLine = cleanLine.substring(1);
        if (cleanLine.endsWith('|')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
        
        // Skip markdown separator row: ---|---
        if (/^[\s-]+\|[\s-]+/.test(cleanLine) || /^[\s-]+$/.test(cleanLine)) return;

        const cells = cleanLine.split('|').map(c => c.trim());
        const cellWidthPercent = Math.floor(100 / cells.length);
        
        const tableCells = cells.map(cellText => {
          return new TableCell({
            children: [new Paragraph({
              children: parseRichText(cellText),
              alignment: AlignmentType.LEFT
            })],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
            width: {
              size: cellWidthPercent * 50, // Convert to 50ths of a percent (e.g., 100% = 5000)
              type: WidthType.PERCENTAGE,
            },
            margins: {
              top: 100, // Twips
              bottom: 100,
              left: 100,
              right: 100,
            }
          });
        });

        rows.push(new TableRow({ children: tableCells }));
      });

      if (rows.length > 0) {
        children.push(new Table({
          rows: rows,
          width: {
            size: 5000, // 100%
            type: WidthType.PERCENTAGE,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          }
        }));
      }
      tableBuffer = [];
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // --- Table Detection ---
      if (line.startsWith('|')) {
        inTable = true;
        tableBuffer.push(line);
        continue;
      }
      if (inTable) {
        processTable();
      }

      if (!line) {
        // Empty line -> Spacing
        children.push(new Paragraph({
          text: "", 
          spacing: { after: 120 } // 6pt spacing
        }));
        continue;
      }

      // --- Headings ---
      if (line.startsWith('# ')) {
        const text = line.substring(2);
        children.push(new Paragraph({
          children: [new TextRun({ text: text, bold: true, size: 32, font: "Times New Roman" })], // 16pt
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 }
        }));
        continue;
      }

      if (line.startsWith('## ')) {
        const text = line.substring(3);
        children.push(new Paragraph({
          children: [new TextRun({ text: text, bold: true, size: 28, font: "Times New Roman" })], // 14pt
          alignment: AlignmentType.LEFT,
          spacing: { before: 240, after: 120 }
        }));
        continue;
      }

      if (line.startsWith('---')) {
        // Horizontal rule -> Just nice spacing with border
         children.push(new Paragraph({
          text: "", 
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "auto" } },
          spacing: { before: 120, after: 120 }
        }));
        continue;
      }

      if (line.startsWith('>')) {
         // Blockquote/Guide
         const text = line.substring(1).trim();
         children.push(new Paragraph({
          children: parseRichText(text),
          indent: { left: 720 }, // Indent 0.5 inch
          spacing: { after: 120 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, space: 4, color: "000000" }} // simulated quote bar
        }));
        continue;
      }

      // --- Question Detection: **Câu X:** or **Câu X.** ---
      const questionMatch = line.match(/^\*\*Câu\s+(\d+)(?:[:.])\*\*\s*(.*)/) || line.match(/^Câu\s+(\d+)(?:[:.])\s*(.*)/);
      if (questionMatch) {
        const num = questionMatch[1];
        const rest = questionMatch[2];
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `Câu ${num}.`, bold: true, font: "Times New Roman", size: 26 }),
            new TextRun({ text: " ", font: "Times New Roman", size: 26 }),
            ...parseRichText(rest)
          ],
          spacing: { before: 240, after: 60 } // Space before question
        }));
        continue;
      }

      // --- Option Detection: **A.** or A. ---
      const optionMatch = line.match(/^\*\*([A-D])(?:[:.])\*\*\s*(.*)/) || line.match(/^([A-D])(?:[:.])\s+(.*)/);
      if (optionMatch) {
        const label = optionMatch[1];
        const rest = optionMatch[2];
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${label}.`, bold: true, font: "Times New Roman", size: 26 }),
            new TextRun({ text: " ", font: "Times New Roman", size: 26 }),
            ...parseRichText(rest)
          ],
          indent: { left: 720 }, // Indent 0.5 inch (~1.27cm)
          spacing: { after: 60 }
        }));
        continue;
      }

      // --- Normal Text ---
      children.push(new Paragraph({
        children: parseRichText(line),
        spacing: { after: 120 }
      }));
    }

    if (inTable) processTable();

    // Create Document
    const doc = new Document({
      styles: {
        default: {
            document: {
                run: {
                    font: "Times New Roman",
                    size: 26,
                }
            }
        }
      },
      sections: [{
        properties: {
             page: {
                margin: {
                    top: 1440, // 1 inch = 1440 twips
                    right: 1440,
                    bottom: 1440,
                    left: 1440,
                },
            },
        },
        children: children
      }]
    });

    try {
        // Generate Blob
        const blob = await Packer.toBlob(doc);
        
        // Download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${activeTab}_${new Date().getTime()}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error generating DOCX:", error);
        alert("Có lỗi khi tạo file Word. Vui lòng thử lại.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full">
      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
        {data.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus:outline-none ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 border-t-2 border-t-blue-600 border-b-white -mb-px'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-slate-100 flex justify-end gap-2 bg-white">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
        >
          {copiedId === activeTab ? (
            <>
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              Copy Text
            </>
          )}
        </button>
        <button
           onClick={handleDownload}
           className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded transition-colors"
        >
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           Download .txt
        </button>
        <button
           onClick={handleDownloadDoc}
           className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
        >
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
           Download .docx
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded shadow-sm min-h-[500px]">
          <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800 leading-relaxed">
            {activeContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
