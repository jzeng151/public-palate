import { gradeDetails } from '@/lib/presentation';

export function GradeCard({grade,small=false}:{grade:string;small?:boolean}){
  const info=gradeDetails(grade);
  return <span className={`grade-card grade-${info.tone}${small?' grade-small':''}`} aria-label={`${info.label}. ${info.description}`}>
    <span className="grade-letter" aria-hidden="true">{info.short}</span>
    <span className="grade-caption" aria-hidden="true">Health grade</span>
  </span>;
}
