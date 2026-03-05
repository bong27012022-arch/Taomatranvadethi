
import React, { useEffect, useState } from 'react';

const steps = [
  "Phân tích ma trận đề thi...",
  "Kiểm tra logic tính điểm...",
  "Tìm kiếm câu hỏi phù hợp...",
  "Sinh nội dung Đề 01...",
  "Sinh nội dung Đề 02 (đảm bảo không trùng lặp)...",
  "Tạo đáp án chi tiết...",
  "Hoàn thiện định dạng..."
];

export const LoadingScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2500); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full w-full bg-white/50 backdrop-blur-sm rounded-3xl">
      <div className="spinner mb-6 relative">
          <div className="w-16 h-16 border-4 border-[#f3f3f3] border-t-[#4A90E2] rounded-full animate-spin"></div>
      </div>
      
      <h3 className="text-2xl font-bold text-[#2C3E50] mb-2">Đang khởi tạo đề thi</h3>
      <p className="text-[#7F8C8D] mb-8 max-w-md font-medium">
        Hệ thống AI đang phân tích dữ liệu và biên soạn đề thi theo tiêu chuẩn BGD.
      </p>

      {/* Steps indicator */}
      <div className="flex flex-col items-center gap-2">
          {steps.map((step, idx) => {
              // Only show current, previous and next one logic if list is long, 
              // but here let's just show current active one with nice fade
              if (idx === currentStep) {
                  return (
                      <div key={idx} className="bg-[#EBF5FF] text-[#4A90E2] px-4 py-2 rounded-lg font-semibold animate-pulse transition-all">
                          <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                          {step}
                      </div>
                  )
              }
              return null;
          })}
      </div>
      
      <div className="mt-4 flex gap-1">
          {steps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1 rounded-full transition-all duration-300 ${idx <= currentStep ? 'w-6 bg-[#4A90E2]' : 'w-2 bg-slate-200'}`}
              ></div>
          ))}
      </div>
    </div>
  );
};
