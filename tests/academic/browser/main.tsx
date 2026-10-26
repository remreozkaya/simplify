import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AcademicProvider from '@/components/academic/AcademicProvider';
import { academicStorage } from '@/lib/academic/storage';
import { parseCurrentSemester, serializeCurrentSemester } from '@/lib/curriculum/semesters';
import '@/app/globals.css';

function Probe() {
  const [name, setName] = useState(() => parseCurrentSemester(academicStorage.getItem('simplify-current-semester-v1'))[0]?.courseName ?? '');
  return <main className="p-8"><h1>Account storage fixture</h1><label>Course name<input className="m-4 border p-2" value={name} onChange={event => {
    setName(event.target.value);
    academicStorage.setItem('simplify-current-semester-v1', serializeCurrentSemester([{ courseCode: 'TEST 101', courseName: event.target.value || 'Untitled', credit: 3, grade: null }]));
  }} /></label></main>;
}
const account = new URLSearchParams(location.search).get('account') ?? 'A';
createRoot(document.getElementById('root')!).render(<AcademicProvider key={account} userId={account}><Probe /></AcademicProvider>);
