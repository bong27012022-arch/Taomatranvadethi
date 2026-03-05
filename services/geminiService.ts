
import { GoogleGenAI, Type, Schema, Part } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { ExamOutput, InputData, DifficultyLevel } from "../types";

const MODELS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-2.5-flash'
];

export const generateExams = async (
  matrix: InputData, 
  spec: InputData, 
  reference: InputData,
  difficulty: DifficultyLevel,
  apiKey: string
): Promise<ExamOutput> => {
  if (!apiKey) {
    throw new Error("Vui lòng nhập API Key trong phần Cài đặt để sử dụng ứng dụng.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const parts: Part[] = [];

  // Instruction part
  parts.push({ text: "Dưới đây là các dữ liệu đầu vào để biên soạn đề thi:" });

  // Matrix part
  parts.push({ text: "\n=== 1. MA TRẬN ĐỀ THI (BẮT BUỘC) ===\n" });
  if (matrix.type === 'text') {
    parts.push({ text: matrix.value });
  } else {
    parts.push({ inlineData: { mimeType: matrix.type, data: matrix.value } });
  }

  // Specification part
  parts.push({ text: "\n=== 2. BẢNG ĐẶC TẢ (BẮT BUỘC) ===\n" });
  if (spec.type === 'text') {
    parts.push({ text: spec.value });
  } else {
    parts.push({ inlineData: { mimeType: spec.type, data: spec.value } });
  }

  // Reference part (Optional)
  if (reference.value && reference.value.trim() !== '') {
    parts.push({ text: "\n=== 3. TÀI LIỆU THAM KHẢO (ĐỀ CƯƠNG/ĐỀ MẪU) ===\n" });
    parts.push({ text: "Hãy sử dụng tài liệu này để tham khảo cách ra đề, phong cách câu hỏi, hoặc lấy ý tưởng nội dung phù hợp với ma trận.\n" });
    if (reference.type === 'text') {
      parts.push({ text: reference.value });
    } else {
      parts.push({ inlineData: { mimeType: reference.type, data: reference.value } });
    }
  }

  // Difficulty Instruction
  parts.push({ text: `\n=== 4. YÊU CẦU VỀ MỨC ĐỘ ĐỀ ===\n` });
  parts.push({ text: `Hãy biên soạn đề thi với mức độ: "${difficulty}".\n` });
  parts.push({ text: `Tuân thủ hướng dẫn trong System Prompt để điều chỉnh câu hỏi theo mức độ này.\n` });

  // Final trigger
  parts.push({ text: "\nHãy thực hiện nhiệm vụ biên soạn đề thi ngay bây giờ." });

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      analysis: { type: Type.STRING, description: "Phân tích cấu trúc, tính điểm, và giải thích cách sử dụng tài liệu tham khảo/điều chỉnh độ khó." },
      exam1: { type: Type.STRING, description: "Nội dung Đề 01" },
      key1: { type: Type.STRING, description: "Đáp án Đề 01" },
      exam2: { type: Type.STRING, description: "Nội dung Đề 02" },
      key2: { type: Type.STRING, description: "Đáp án Đề 02" },
    },
    required: ["analysis", "exam1", "key1", "exam2", "key2"],
  };

  let lastError = null;

  for (const modelName of MODELS) {
    try {
      console.log(`Attempting with model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.7,
        },
      });

      const text = response.text;
      if (!text) {
          const finishReason = response.candidates?.[0]?.finishReason;
          throw new Error(`AI không trả về nội dung (Finish Reason: ${finishReason}) với model ${modelName}.`);
      }

      try {
          const parsed = JSON.parse(text) as ExamOutput;
          return parsed;
      } catch (jsonError) {
          console.error(`JSON Parse Error with model ${modelName}:`, jsonError);
          // Only retry if it's a model issue, but here we retry for any error in the loop
          throw new Error(`Dữ liệu trả về từ AI (${modelName}) không đúng định dạng JSON.`);
      }

    } catch (error: any) {
      console.error(`Error with model ${modelName}:`, error);
      lastError = error;
      // Continue to next model
      continue;
    }
  }

  // If we get here, all models failed
  throw lastError || new Error("Tất cả các model đều thất bại. Vui lòng thử lại sau.");
};
