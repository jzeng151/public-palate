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
export type CuisinePhoto = 'pizza' | 'pasta' | 'sushi' | 'noodles' | 'salad' | 'coffee' | 'burger' | 'grill';

interface CuisinePhraseRule {
  readonly photo: CuisinePhoto;
  readonly phrases: readonly string[];
}

interface CuisineTokenRule {
  readonly photo: CuisinePhoto;
  readonly tokens: readonly string[];
}

const CUISINE_PHRASE_RULES: readonly CuisinePhraseRule[] = [
  { photo: 'grill', phrases: ['latin american'] },
];

const CUISINE_TOKEN_RULES: readonly CuisineTokenRule[] = [
  { photo: 'pizza', tokens: ['pizza', 'pizzas'] },
  { photo: 'pasta', tokens: ['italian', 'pasta'] },
  { photo: 'sushi', tokens: ['japanese', 'sushi'] },
  { photo: 'noodles', tokens: ['chinese', 'thai', 'vietnamese', 'korean', 'asian', 'noodle', 'noodles'] },
  { photo: 'salad', tokens: ['vegetarian', 'salad', 'salads', 'mediterranean', 'vegan'] },
  { photo: 'coffee', tokens: ['coffee', 'tea', 'bakery', 'donut', 'donuts', 'dessert', 'desserts', 'café', 'cafés', 'cafe', 'cafes'] },
  { photo: 'burger', tokens: ['american', 'hamburger', 'hamburgers', 'sandwich', 'sandwiches'] },
];

function normalizeCuisineTokens(cuisine: string): string[] {
  return cuisine.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function cuisinePhoto(cuisine: string): CuisinePhoto {
  const tokens = normalizeCuisineTokens(cuisine);
  const paddedPhrase = ` ${tokens.join(' ')} `;

  for (const rule of CUISINE_PHRASE_RULES) {
    if (rule.phrases.some((phrase) => paddedPhrase.includes(` ${phrase} `))) {
      return rule.photo;
    }
  }

  const tokenSet = new Set(tokens);
  for (const rule of CUISINE_TOKEN_RULES) {
    if (rule.tokens.some((token) => tokenSet.has(token))) {
      return rule.photo;
    }
  }

  return 'grill';
}
