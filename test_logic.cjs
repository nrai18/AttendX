
const year = "3";
const semesterOption = "5";
const startMonth = "2026-08";
const endMonth = "2028-12";
const suffix = year === "1" ? "st" : year === "2" ? "nd" : year === "3" ? "rd" : "th";
const generatedName = `Semester ${semesterOption} (${year}${suffix} Year)`;
const startDate = `${startMonth}-01`;
const [endY, endM] = endMonth.split("-");
const lastDay = new Date(parseInt(endY), parseInt(endM), 0).getDate();
const endDate = `${endMonth}-${lastDay.toString().padStart(2, "0")}`;
console.log({generatedName, startDate, endDate});

