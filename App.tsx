
import React, { useState } from 'react';
import { generateExams } from './services/geminiService';
import { ExamOutput, GenerationStatus, TabItem, InputData, DifficultyLevel } from './types';
import { ExamDisplay } from './components/ExamDisplay';
import { LoadingScreen } from './components/LoadingScreen';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

const App: React.FC = () => {
  const [matrixInput, setMatrixInput] = useState<InputData>({ type: 'text', value: '' });
  const [specInput, setSpecInput] = useState<InputData>({ type: 'text', value: '' });
  const [refInput, setRefInput] = useState<InputData>({ type: 'text', value: '' });
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DifficultyLevel.EQUIVALENT);

  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [result, setResult] = useState<ExamOutput | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  React.useEffect(() => {
    const storedKey = localStorage.getItem('GEMINI_API_KEY');
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      setShowSettings(true);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    setShowSettings(false);
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setShowSettings(true);
      setErrorMsg("Vui lòng nhập API Key để tiếp tục.");
      return;
    }

    if (!matrixInput.value.trim() || !specInput.value.trim()) {
      setErrorMsg("Vui lòng nhập đầy đủ nội dung Ma trận và Bảng đặc tả.");
      return;
    }

    setStatus(GenerationStatus.GENERATING);
    setErrorMsg(null);
    setResult(null);

    try {
      const output = await generateExams(matrixInput, specInput, refInput, difficulty, apiKey);
      setResult(output);
      setStatus(GenerationStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setStatus(GenerationStatus.ERROR);
      setErrorMsg(err.message || "Đã xảy ra lỗi khi sinh đề thi. Vui lòng thử lại.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setInput: (data: InputData) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();

      if (file.type === PDF_MIME || file.type === DOCX_MIME) {
        reader.onload = (event) => {
          const result = event.target?.result as string;
          // result format is "data:<mime>;base64,....."
          const base64 = result.split(',')[1];
          setInput({ type: file.type as any, value: base64, name: file.name });
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setInput({ type: 'text', value: text, name: file.name });
        };
        reader.readAsText(file);
      }
    }
  };

  const clearInput = (setInput: (data: InputData) => void) => {
    setInput({ type: 'text', value: '' });
  };

  // --- UI Components for specific sections based on the new design ---

  // Helper for Section 1 & 2 (Purple & Pink)
  const renderStandardCard = (
    number: string,
    title: string,
    iconClass: string,
    colorTheme: 'purple' | 'pink',
    inputData: InputData,
    setInput: (data: InputData) => void,
    placeholder: string
  ) => {
    const themeColors = {
      purple: {
        badge: 'bg-[#9B59B6]',
        icon: 'text-[#9B59B6]',
        focus: 'focus:border-[#9B59B6] focus:ring-[#9B59B6]',
        btnText: 'text-[#9B59B6]',
        btnBorder: 'border-[#9B59B6]/30',
        btnHover: 'hover:bg-[#9B59B6]/5'
      },
      pink: {
        badge: 'bg-[#E91E63]',
        icon: 'text-[#E91E63]',
        focus: 'focus:border-[#E91E63] focus:ring-[#E91E63]',
        btnText: 'text-[#E91E63]',
        btnBorder: 'border-[#E91E63]/30',
        btnHover: 'hover:bg-[#E91E63]/5'
      }
    };
    const c = themeColors[colorTheme];
    const isFile = inputData.type !== 'text';

    return (
      <div className="bg-white rounded-2xl p-7 shadow-[0_10px_30px_rgba(0,0,0,0.05)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full border border-black/5">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 ${c.badge}`}>
              {number}
            </div>
            <h2 className="text-xl font-bold text-[#2C3E50]">{title}</h2>
          </div>
          <i className={`${iconClass} text-2xl opacity-20 ${c.icon}`}></i>
        </div>

        <div className="flex flex-col gap-3 flex-grow">
          <div className="flex justify-end gap-2">
            {inputData.value && (
              <button
                onClick={() => clearInput(setInput)}
                className="px-3 py-1 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <i className="fa-solid fa-trash mr-1"></i> Xóa
              </button>
            )}
            <label className={`cursor-pointer px-3 py-1.5 rounded-lg border text-sm font-semibold flex items-center gap-2 transition-all ${c.btnText} ${c.btnBorder} ${c.btnHover}`}>
              <i className="fa-solid fa-cloud-arrow-up"></i> Upload File
              <input
                type="file"
                className="hidden"
                accept=".txt,.md,.pdf,.docx"
                onChange={(e) => handleFileUpload(e, setInput)}
              />
            </label>
          </div>

          {isFile ? (
            <div className={`w-full h-[150px] p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-2 border-dashed border-2`}>
              <i className={`fa-solid ${inputData.type === PDF_MIME ? 'fa-file-pdf text-red-500' : 'fa-file-word text-blue-600'} text-3xl`}></i>
              <div className="text-center">
                <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{inputData.name}</p>
              </div>
            </div>
          ) : (
            <textarea
              className={`w-full h-[150px] p-4 bg-[#FAFAFA] border border-[#E0E0E0] rounded-xl resize-none text-sm font-sans focus:outline-none focus:ring-1 transition-all placeholder-slate-400 ${c.focus}`}
              placeholder={placeholder}
              value={inputData.value}
              onChange={(e) => setInput({ type: 'text', value: e.target.value })}
            />
          )}
        </div>
      </div>
    );
  };

  // Section 3 (Teal - Large Upload Area)
  const renderReferenceCard = () => {
    const isFile = refInput.value !== '' && refInput.value !== undefined;

    return (
      <div className="bg-white rounded-2xl p-7 shadow-[0_10px_30px_rgba(0,0,0,0.05)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full border border-black/5">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 bg-[#00BCD4]">3</div>
            <h2 className="text-xl font-bold text-[#2C3E50]">File tham khảo (Tùy chọn)</h2>
          </div>
          <i className="fa-regular fa-folder-open text-2xl opacity-20 text-[#00BCD4]"></i>
        </div>

        <div className="flex-grow flex flex-col">
          <label className={`
                relative flex-grow min-h-[150px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                ${isFile
              ? 'border-[#00BCD4] bg-[#00BCD4]/10'
              : 'border-[#ddd] hover:bg-[#00BCD4]/5 hover:border-[#00BCD4]'
            }
            `}>
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.docx"
              onChange={(e) => handleFileUpload(e, setRefInput)}
            />

            {isFile ? (
              <div className="flex flex-col items-center gap-2 text-[#2C3E50] animate-fade-in">
                <i className={`fa-solid ${refInput.type === PDF_MIME ? 'fa-file-pdf text-red-500' : (refInput.type === DOCX_MIME ? 'fa-file-word text-blue-600' : 'fa-file-lines text-slate-500')} text-4xl`}></i>
                <span className="font-bold text-sm">{refInput.name || 'File đã tải lên'}</span>
                <span className="text-xs text-[#00BCD4] font-semibold bg-white/50 px-2 py-1 rounded">Click để thay đổi</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    clearInput(setRefInput);
                  }}
                  className="absolute top-2 right-2 text-red-500 hover:bg-red-100 p-1 rounded"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
            ) : (
              <>
                <i className="fa-solid fa-cloud-arrow-up text-3xl mb-3 text-[#00BCD4]"></i>
                <span className="text-[#7F8C8D] font-medium">Click để upload đề thi hoặc câu hỏi</span>
                <span className="text-xs text-[#95a5a6] mt-1">(Hỗ trợ PDF, DOCX, TXT)</span>
              </>
            )}
          </label>
        </div>
      </div>
    );
  };

  // Section 4 (Orange - Config & Generate)
  const renderConfigCard = () => {
    return (
      <div className="bg-white rounded-2xl p-7 shadow-[0_10px_30px_rgba(0,0,0,0.05)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full border border-black/5">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 bg-[#FF6B35]">4</div>
            <h2 className="text-xl font-bold text-[#2C3E50]">Cấu hình & Tạo đề</h2>
          </div>
          <i className="fa-solid fa-sliders text-2xl opacity-20 text-[#FF6B35]"></i>
        </div>

        <h3 className="text-base font-medium text-[#2C3E50] mb-4">Mức độ đề thi mong muốn</h3>

        <div className="flex flex-col gap-3 mb-6">
          {Object.values(DifficultyLevel).map((level) => {
            const isSelected = difficulty === level;
            return (
              <label
                key={level}
                className={`
                  flex items-center px-4 py-3 rounded-xl border cursor-pointer transition-all duration-200
                  ${isSelected
                    ? 'bg-[#FFF8F5] border-[#FF6B35]'
                    : 'border-[#E0E0E0] hover:bg-slate-50'
                  }
                `}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={level}
                  checked={isSelected}
                  onChange={() => setDifficulty(level)}
                  className="w-5 h-5 accent-[#FF6B35] mr-4"
                />
                <span className={`flex-grow font-medium ${isSelected ? 'text-[#FF6B35]' : 'text-[#2C3E50]'}`}>
                  {level.split('(')[0]}
                  {level.includes('(') && <span className="text-xs font-normal ml-1 opacity-70">({level.split('(')[1]}</span>}
                </span>
                {/* Optional tags similar to design */}
                <span className="text-xs px-2 py-1 rounded bg-[#F0F0F0] text-[#666]">
                  {level.includes('Dễ') ? 'Nhận biết' :
                    level.includes('Tương đương') ? 'Thông hiểu' :
                      level.includes('Khó') ? 'Vận dụng' : 'Toán thực tế'}
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-auto">
          <button
            onClick={handleGenerate}
            disabled={!matrixInput.value || !specInput.value}
            className={`
                    w-full py-4 rounded-xl text-lg font-bold shadow-[0_10px_20px_rgba(255,107,53,0.3)] transition-all duration-200 flex items-center justify-center gap-3 uppercase tracking-wide
                    ${!matrixInput.value || !specInput.value
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-br from-[#FF6B35] to-[#FF8F66] text-white hover:-translate-y-[2px] hover:shadow-[0_15px_25px_rgba(255,107,53,0.4)] active:translate-y-[1px]'
              }
                `}
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            Tiến hành tạo đề thi
          </button>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const tabs: TabItem[] = [
      { id: 'analysis', label: '📊 Phân tích & Xử lý', content: result!.analysis },
      { id: 'exam1', label: '📄 Đề thi 01', content: result!.exam1 },
      { id: 'key1', label: '🔑 Đáp án 01', content: result!.key1 },
      { id: 'exam2', label: '📄 Đề thi 02', content: result!.exam2 },
      { id: 'key2', label: '🔑 Đáp án 02', content: result!.key2 },
    ];
    return <ExamDisplay data={tabs} />;
  }

  // Settings Modal
  const renderSettingsModal = () => {
    if (!showSettings) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in relative">
          <button
            onClick={() => setShowSettings(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          >
            <i className="fa-solid fa-times text-xl"></i>
          </button>

          <h2 className="text-2xl font-bold text-[#2C3E50] mb-2 flex items-center gap-2">
            <i className="fa-solid fa-gear text-blue-500"></i>
            Cài đặt hệ thống
          </h2>
          <p className="text-sm text-slate-500 mb-6">Cấu hình API Key và Model AI để sử dụng ứng dụng.</p>

          {/* Model List Display (Static as requested) */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#2C3E50] mb-2">Mô hình AI & Fallback</label>
            <div className="space-y-2">
              {[
                { name: 'gemini-3-flash-preview', type: 'Default (Fastest)', color: 'bg-green-100 text-green-700 border-green-200' },
                { name: 'gemini-3-pro-preview', type: 'Fallback 1 (Smartest)', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                { name: 'gemini-2.5-flash', type: 'Fallback 2 (Reliable)', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
              ].map((m, idx) => (
                <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${m.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{idx + 1}.</span>
                    <span className="font-medium">{m.name}</span>
                  </div>
                  <span className="text-xs opacity-75 hidden sm:inline-block">{m.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* API Key Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[#2C3E50] mb-2">
              Gemini API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              placeholder="Nhập API Key của bạn..."
              defaultValue={apiKey}
              onBlur={(e) => handleSaveApiKey(e.target.value)}
            />
            <div className="mt-2 text-xs flex flex-col gap-1">
              <p className="text-slate-500">
                Chưa có API Key? <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-medium">Lấy key tại đây</a>
              </p>
              <p className="text-slate-500">
                <a href="https://drive.google.com/drive/folders/1G6eiVeeeEvsYgNk2Om7FEybWf30EP1HN?usp=drive_link" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-medium">Xem hướng dẫn chi tiết</a>
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                // Input onBlur handles save, just close here or rely on user typing
                const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                if (input) handleSaveApiKey(input.value);
              }}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-lg shadow-blue-500/30"
            >
              Lưu & Bắt đầu
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] font-sans text-[#2C3E50] p-5 pb-0 flex flex-col">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 pt-2">
        {/* Title Left */}
        <div className="flex items-center gap-4">
          <div className="w-[45px] h-[45px] bg-gradient-to-br from-[#4facfe] to-[#00f2fe] rounded-xl flex items-center justify-center text-white text-xl shadow-[0_4px_15px_rgba(74,144,226,0.3)]">
            <i className="fa-solid fa-brain"></i>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-[#2C3E50] to-[#4A90E2] bg-clip-text text-transparent tracking-tight">
              Toán THPT Generator <span className="bg-[#EBF5FF] text-[#4A90E2] px-2 py-0.5 rounded-full text-xs align-top ml-1">v4.0</span>
            </h1>
            <p className="text-[#7F8C8D] text-xs font-medium">Kết nối tri thức • Chuẩn BGD</p>
          </div>
        </div>

        {/* Settings Right */}
        <button
          onClick={() => setShowSettings(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${!apiKey ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          <i className="fa-solid fa-gear"></i>
          <span className="font-semibold">{!apiKey ? 'Lấy API key để sử dụng app' : 'Cài đặt'}</span>
        </button>
      </header>

      {/* Main Container */}
      <div className="max-w-[1200px] w-full mx-auto flex-1 mb-10">

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-center gap-4 text-red-700 shadow-sm animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-exclamation text-red-500"></i>
            </div>
            <div>
              <h3 className="font-bold text-sm">Lỗi xử lý</h3>
              <p className="text-sm opacity-90">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Content Switcher */}
        {status === GenerationStatus.GENERATING ? (
          <div className="h-[600px] flex items-center justify-center">
            <LoadingScreen />
          </div>
        ) : status === GenerationStatus.SUCCESS && result ? (
          <div className="animate-fade-in h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-[#2C3E50]">Kết quả sinh đề</h2>
              <button
                onClick={() => { setStatus(GenerationStatus.IDLE); setResult(null); }}
                className="px-4 py-2 bg-white text-[#7F8C8D] font-medium rounded-lg shadow-sm hover:text-[#2C3E50] transition-colors"
              >
                <i className="fa-solid fa-arrow-left mr-2"></i> Quay lại
              </button>
            </div>
            {renderResults()}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
            {/* 1. Matrix */}
            <div className="h-full min-h-[320px]">
              {renderStandardCard(
                "1",
                "Ma trận đề thi",
                "fa-solid fa-table-cells",
                "purple",
                matrixInput,
                setMatrixInput,
                "Paste nội dung ma trận vào đây hoặc upload file..."
              )}
            </div>

            {/* 2. Spec */}
            <div className="h-full min-h-[320px]">
              {renderStandardCard(
                "2",
                "Bảng đặc tả",
                "fa-solid fa-list-check",
                "pink",
                specInput,
                setSpecInput,
                "Paste nội dung bảng đặc tả vào đây hoặc upload file..."
              )}
            </div>

            {/* 3. Reference */}
            <div className="h-full min-h-[250px]">
              {renderReferenceCard()}
            </div>

            {/* 4. Config */}
            <div className="h-full min-h-[400px] md:row-span-2 md:col-start-2 md:row-start-2">
              {renderConfigCard()}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {renderSettingsModal()}

      {/* Footer Promotion */}
      <footer className="bg-slate-800 text-slate-300 py-8 px-4 mt-auto border-t border-slate-700 no-print">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6 p-6 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-2xl border border-blue-500/20 backdrop-blur-sm">
            <p className="font-bold text-lg md:text-xl text-blue-200 mb-3 leading-relaxed">
              ĐĂNG KÝ KHOÁ HỌC THỰC CHIẾN VIẾT SKKN, TẠO APP DẠY HỌC, TẠO MÔ PHỎNG TRỰC QUAN <br className="hidden md:block" />
              <span className="text-yellow-400">CHỈ VỚI 1 CÂU LỆNH</span>
            </p>
            <a
              href="https://forms.gle/19fbZmmHW5rEtxxG7"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all transform hover:-translate-y-1 shadow-lg shadow-blue-900/50"
            >
              ĐĂNG KÝ NGAY
            </a>
          </div>

          <div className="space-y-2 text-sm md:text-base">
            <p className="font-medium text-slate-400">Mọi thông tin vui lòng liên hệ:</p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6">
              <a
                href="https://www.facebook.com/tranhoaithanhvicko/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-400 transition-colors duration-200 flex items-center gap-2"
              >
                <span className="font-bold">Facebook:</span> tranhoaithanhvicko
              </a>
              <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-slate-600"></div>
              <span className="hover:text-emerald-400 transition-colors duration-200 cursor-default flex items-center gap-2">
                <span className="font-bold">Zalo:</span> 0348296773
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
