import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cuisinePhoto, type CuisinePhoto } from '../lib/presentation.ts';

const VALID_PHOTOS = new Set<CuisinePhoto>([
  'pizza',
  'pasta',
  'sushi',
  'noodles',
  'salad',
  'coffee',
  'burger',
  'grill',
]);

test('cuisinePhoto applies phrase overrides and whole-word Unicode token matching', () => {
  assert.equal(cuisinePhoto('Steakhouse'), 'grill');
  assert.equal(cuisinePhoto('Latin American'), 'grill');
  assert.equal(cuisinePhoto('American'), 'burger');
  assert.equal(cuisinePhoto('Coffee/Tea'), 'coffee');
  assert.equal(cuisinePhoto('Café'), 'coffee');
  assert.equal(cuisinePhoto('Bakery Products/Desserts'), 'coffee');
  assert.equal(cuisinePhoto('Donuts'), 'coffee');
  assert.equal(cuisinePhoto('Sandwiches'), 'burger');
  assert.equal(cuisinePhoto('Hamburgers'), 'burger');
  assert.equal(cuisinePhoto('Pizza'), 'pizza');
  assert.equal(cuisinePhoto('Pizza/Italian'), 'pizza');
  assert.equal(cuisinePhoto('Italian'), 'pasta');
  assert.equal(cuisinePhoto('Japanese'), 'sushi');
  assert.equal(cuisinePhoto('Thai'), 'noodles');
  assert.equal(cuisinePhoto('Vegetarian'), 'salad');
  assert.equal(cuisinePhoto('Salads'), 'salad');
  assert.equal(cuisinePhoto(''), 'grill');
});

test('cuisinePhoto maps every distinct cuisine in data/restaurants.json to a valid photo without regressions', () => {
  const raw = readFileSync(new URL('../data/restaurants.json', import.meta.url), 'utf8');
  const snapshot = JSON.parse(raw) as { restaurants: Array<{ cuisine: string }> };
  const distinctCuisines = [...new Set(snapshot.restaurants.map((r) => r.cuisine))].sort();

  assert.ok(distinctCuisines.length > 0, 'Expected catalog snapshot to contain cuisines');

  for (const cuisine of distinctCuisines) {
    const photo = cuisinePhoto(cuisine);
    assert.ok(VALID_PHOTOS.has(photo), `Unexpected photo "${photo}" for catalog cuisine "${cuisine}"`);

    const lower = cuisine.toLowerCase();
    if (lower.includes('steak')) {
      assert.notEqual(photo, 'coffee', `Steak cuisine "${cuisine}" must not map to coffee`);
    }
    if (lower.includes('latin american')) {
      assert.equal(photo, 'grill', `Latin American cuisine "${cuisine}" must map to grill`);
    }
  }
});
