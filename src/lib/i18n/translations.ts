import tr from "@/lib/i18n/tr";
import en from "@/lib/i18n/en";

type DictionaryShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : DictionaryShape<T[Key]>;
};
export type TranslationDictionary = DictionaryShape<typeof tr>;

export const translations = { tr, en } as const;
export type Language = keyof typeof translations;
