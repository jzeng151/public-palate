export const DATASET_URL = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json';
export const DATASET_PAGE = 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/about_data';

export type InspectionRow = {
  camis: string; dba?: string; boro?: string; building?: string; street?: string;
  zipcode?: string; cuisine_description?: string; grade?: string; grade_date?: string;
  inspection_date?: string; record_date?: string; score?: string; action?: string;
  violation_code?: string; violation_description?: string; critical_flag?: string;
  inspection_type?: string; latitude?: string; longitude?: string; phone?: string;
};
export type Restaurant = {
  id: string; name: string; borough: string; address: string; zip: string;
  cuisine: string; grade: string; gradeDate: string | null;
  inspectionDate: string | null; recordDate: string | null;
};
export function displayName(value = '') {
  return value.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s/\-])\w/g, c => c.toUpperCase());
}
export function validDate(value?: string) {
  return value && value > '1900-01-02' ? value : null;
}
export function consolidateRestaurants(rows: InspectionRow[]): Restaurant[] {
  const groups = new Map<string, InspectionRow[]>();
  for (const row of rows) {
    if (!row.camis || !row.dba) continue;
    const existing = groups.get(row.camis) || [];
    existing.push(row); groups.set(row.camis, existing);
  }
  return [...groups].map(([id, records]) => {
    const newest = [...records].sort((a,b) => (b.inspection_date || '').localeCompare(a.inspection_date || ''))[0];
    const graded = records.filter(r => r.grade && ['A','B','C','N','Z','P'].includes(r.grade))
      .sort((a,b) => (b.grade_date || b.inspection_date || '').localeCompare(a.grade_date || a.inspection_date || '') || (b.inspection_date || '').localeCompare(a.inspection_date || ''))[0];
    return { id, name: displayName(newest.dba), borough: displayName(newest.boro || 'Unknown'),
      address: displayName([newest.building,newest.street].filter(Boolean).join(' ')), zip: newest.zipcode || '',
      cuisine: newest.cuisine_description || 'Not specified', grade: graded?.grade || 'N',
      gradeDate: validDate(graded?.grade_date), inspectionDate: validDate(newest.inspection_date),
      recordDate: validDate(newest.record_date) };
  }).sort((a,b)=>a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function filterRestaurants(restaurants: Restaurant[], params: URLSearchParams) {
  const search = (params.get('q') || '').trim().toLocaleLowerCase().slice(0,100);
  const grades = (params.get('grades') || '').split(',').filter(Boolean);
  return restaurants.filter(r =>
    (!search || `${r.name} ${r.address} ${r.zip}`.toLocaleLowerCase().includes(search)) &&
    (!params.get('borough') || r.borough === params.get('borough')) &&
    (!params.get('cuisine') || r.cuisine === params.get('cuisine')) &&
    (!grades.length || grades.includes(r.grade) || (grades.includes('pending') && ['N','Z','P'].includes(r.grade)))
  );
}
