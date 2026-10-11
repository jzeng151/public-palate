export const gradeInfo: Record<string,{label:string;description:string;tone:string;short:string}>= {
  A:{label:'Grade A',description:'0 to 13 inspection points',tone:'a',short:'A'},
  B:{label:'Grade B',description:'14 to 27 inspection points',tone:'b',short:'B'},
  C:{label:'Grade C',description:'28 or more inspection points',tone:'c',short:'C'},
  Z:{label:'Grade pending',description:'A final letter grade is pending.',tone:'pending',short:'Pending'},
  P:{label:'Grade pending',description:'Pending after reopening following a closure.',tone:'pending',short:'Pending'},
  N:{label:'Not yet graded',description:'No letter grade has been issued in the dataset.',tone:'pending',short:'Not graded'},
};
export function gradeDetails(grade:string){return gradeInfo[grade]||gradeInfo.N;}
export function formatDate(value:string|null|undefined){
  if(!value)return 'Not available';
  const date=new Date(value.slice(0,10)+'T12:00:00Z');
  return Number.isNaN(date.getTime())?'Not available':new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(date);
}
export function cuisinePhoto(cuisine:string){
  const text=cuisine.toLowerCase();
  if(/pizza/.test(text))return 'pizza';
  if(/italian|pasta/.test(text))return 'pasta';
  if(/japanese|sushi/.test(text))return 'sushi';
  if(/chinese|thai|vietnamese|korean|asian|noodle/.test(text))return 'noodles';
  if(/vegetarian|salad|mediterranean|vegan/.test(text))return 'salad';
  if(/coffee|tea|bakery|donut|dessert|café|cafe/.test(text))return 'coffee';
  if(/american|hamburger|sandwich/.test(text))return 'burger';
  return 'grill';
}
