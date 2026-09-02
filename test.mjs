import pkg from 'nepali-date-converter';
const NepaliDate = pkg.default || pkg;

// Test 2062.10.20 (Magh 20, 2062)
const d1 = new NepaliDate(2062, 9, 20); // 0-indexed month: 9 is 10th month (Magh)
console.log('2062-10-20 -> AD JS Date:', d1.toJsDate());
console.log('Year:', d1.toJsDate().getFullYear(), 'Month:', d1.toJsDate().getMonth() + 1, 'Date:', d1.toJsDate().getDate());
