import snapshot from '@/data/restaurants.json';
import { displayName, type Restaurant } from './restaurant-data';

export const restaurants: Restaurant[] = snapshot.restaurants.map(r => ({...r, name:displayName(r.name), address:displayName(r.address)}));
export const catalogFetchedAt = snapshot.fetchedAt;
export const restaurantById = new Map(restaurants.map(r=>[r.id,r]));
export const cuisines = [...new Set(restaurants.map(r=>r.cuisine))].sort();
export const boroughs = ['Manhattan','Brooklyn','Queens','Bronx','Staten Island'];
