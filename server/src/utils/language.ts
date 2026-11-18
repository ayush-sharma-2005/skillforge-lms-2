import type { Request } from "express";

export interface LocalizedCourseData {
  title: string;
  description: string;
  shortDescription?: string;
  activeLanguage: string;
  isTranslated: boolean;
}

export interface LocalizedLessonData {
  title: string;
  description: string;
  transcript?: string;
  activeLanguage: string;
  isTranslated: boolean;
}

export const getPreferredLanguage = (req: Request): string => {
  const queryLang = req.query.lang;
  if (typeof queryLang === "string" && queryLang.trim()) {
    return queryLang.trim().toLowerCase();
  }

  const headerLang = req.headers["accept-language"];
  if (typeof headerLang === "string" && headerLang.trim()) {
    const primary = headerLang.split(",")[0].split(";")[0].trim().toLowerCase();
    const shortCode = primary.split("-")[0];
    return shortCode || "en";
  }

  return "en";
};

export const localizeCourse = <T extends {
  title: string;
  description: string;
  shortDescription?: string;
  language?: string;
  translations?: Array<{
    language: string;
    title: string;
    description: string;
    shortDescription?: string;
  }>;
}>(
  course: T,
  targetLang?: string
): T & LocalizedCourseData => {
  const defaultLang = course.language || "en";
  const reqLang = targetLang?.toLowerCase() || defaultLang;

  if (course.translations && course.translations.length > 0) {
    const match = course.translations.find(
      (t) => t.language.toLowerCase() === reqLang
    );

    if (match) {
      return {
        ...course,
        title: match.title || course.title,
        description: match.description || course.description,
        shortDescription: match.shortDescription || course.shortDescription,
        activeLanguage: reqLang,
        isTranslated: true,
      };
    }
  }

  return {
    ...course,
    activeLanguage: defaultLang,
    isTranslated: false,
  };
};

export const localizeLesson = <T extends {
  title: string;
  description: string;
  translations?: Array<{
    language: string;
    title: string;
    description: string;
    transcript?: string;
  }>;
}>(
  lesson: T,
  targetLang?: string
): T & LocalizedLessonData => {
  const reqLang = targetLang?.toLowerCase() || "en";

  if (lesson.translations && lesson.translations.length > 0) {
    const match = lesson.translations.find(
      (t) => t.language.toLowerCase() === reqLang
    );

    if (match) {
      return {
        ...lesson,
        title: match.title || lesson.title,
        description: match.description || lesson.description,
        transcript: match.transcript,
        activeLanguage: reqLang,
        isTranslated: true,
      };
    }
  }

  return {
    ...lesson,
    activeLanguage: "en",
    isTranslated: false,
  };
};

