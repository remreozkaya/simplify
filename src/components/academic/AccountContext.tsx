'use client';
import { createContext, useContext } from 'react';
export const AcademicAccountContext = createContext<string | null>(null);
export function useAcademicAccount() { return useContext(AcademicAccountContext); }
