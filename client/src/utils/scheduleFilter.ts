/**
 * Dynamic Timetable Filter Utility
 * Maps curriculum hierarchy (Year -> Semester -> Section -> Groups)
 */

export interface SemesterFilterInfo {
  semesterNumber: number;
  yearNumber: number;
  sectionPrefix: string;
  hasElectives: boolean;
  hasLargeLabBlocks: boolean;
}

/**
 * Parses the semester name (e.g., "Semester 5 (IT)", "Sem 3", "Semester 7")
 * to extract year, semester, and rules.
 */
export const getSemesterFilterInfo = (semesterName: string): SemesterFilterInfo => {
  const normalizedName = semesterName.toLowerCase();
  
  // Extract number (e.g., 3, 5, 7)
  const match = normalizedName.match(/(?:semester|sem)\s*(\d+)/i) || normalizedName.match(/(\d+)/);
  const semesterNumber = match ? parseInt(match[1], 10) : 5; // Default to 5 if unknown

  const yearNumber = Math.ceil(semesterNumber / 2);
  const sectionPrefix = String(yearNumber);
  const hasElectives = semesterNumber === 5;
  const hasLargeLabBlocks = semesterNumber === 7;

  return {
    semesterNumber,
    yearNumber,
    sectionPrefix,
    hasElectives,
    hasLargeLabBlocks,
  };
};

/**
 * Frontend helper to determine if the wizard should prompt for electives.
 */
export const shouldShowElectives = (semesterName: string): boolean => {
  return getSemesterFilterInfo(semesterName).hasElectives;
};
