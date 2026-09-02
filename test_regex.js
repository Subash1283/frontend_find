const text = "नाम धर: सुमित श्रेष्ठ 0 लिङ्ग: पुरुष";
const regex = /नाम\s*(?:थर|धर|यर|घर)?\s*[:\-\/~.]+\s*[-~]*\s*(.+?)(?:\s*(?:लिङ्ग|sex|gender|date|जन्म|dob|born|\d|[०-९])|$)/i;

const match = text.match(regex);
console.log("Match:", match);
