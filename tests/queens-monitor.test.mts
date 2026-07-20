import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { neighborhoodAreas } from '../src/queens/data/neighborhoods.ts';
import { people, stories } from '../src/queens/data/stories.ts';
import type { CalendarEvent } from '../src/queens/types.ts';

const unique = (values: string[]) => new Set(values).size === values.length;

test('story records are unique, geocoded, sourced, and connected', () => {
  assert.ok(stories.length >= 11);
  assert.ok(unique(stories.map(({ id }) => id)));
  assert.ok(new Set(stories.map(({ neighborhood }) => neighborhood)).size >= 9);

  for (const story of stories) {
    assert.match(story.streetAddress, /Queens|NY|Flushing|Astoria|Corona|Jamaica|St\. Albans|Forest Hills|Long Island City|South Ozone Park/i);
    assert.ok(story.latitude >= 40.45 && story.latitude <= 41);
    assert.ok(story.longitude >= -74.3 && story.longitude <= -73.6);
    assert.ok(story.connections.length > 0, `${story.id} needs a world connection`);
    assert.ok(story.sources.length > 0, `${story.id} needs a source`);
    story.sources.forEach(({ url }) => assert.doesNotThrow(() => new URL(url)));
  }
});

test('coverage uses the complete residential Queens NTA baseline', () => {
  assert.equal(neighborhoodAreas.length, 59);
  assert.ok(unique(neighborhoodAreas.map(({ id }) => id)));
  const validAreaIds = new Set(neighborhoodAreas.map(({ id }) => id));
  const coveredAreaIds = new Set(stories.flatMap(({ coverageAreaIds }) => coverageAreaIds));

  for (const story of stories) {
    assert.ok(story.coverageAreaIds.length > 0, `${story.id} needs a coverage area`);
    story.coverageAreaIds.forEach((id) => assert.ok(validAreaIds.has(id), `${story.id} references missing coverage area ${id}`));
  }
  assert.ok(coveredAreaIds.size >= 24);
});

test('people and story references are internally consistent', () => {
  const storyIds = new Set(stories.map(({ id }) => id));
  const personIds = new Set(people.map(({ id }) => id));
  assert.ok(unique(people.map(({ id }) => id)));

  for (const person of people) {
    assert.ok(person.storyIds.length > 0);
    person.storyIds.forEach((id) => assert.ok(storyIds.has(id), `${person.id} references missing story ${id}`));
    assert.doesNotThrow(() => new URL(person.source.url));
  }
  for (const story of stories) {
    story.personIds.forEach((id) => assert.ok(personIds.has(id), `${story.id} references missing person ${id}`));
    assert.ok(unique(story.connections.map(({ id }) => id)), `${story.id} has duplicate connection IDs`);
  }
});

test('the Queens Calendar snapshot has canonical, geocoded event records', async () => {
  const raw = await readFile(new URL('../src/queens/data/calendar-events.json', import.meta.url), 'utf8');
  const events = JSON.parse(raw) as CalendarEvent[];
  assert.ok(events.length > 0);
  assert.ok(unique(events.map(({ id }) => id)));

  for (const event of events) {
    assert.ok(event.title);
    assert.ok(event.slug);
    assert.ok(Number.isFinite(new Date(event.startDate).getTime()));
    assert.ok(event.venue.name);
    assert.ok(Number.isFinite(event.venue.latitude));
    assert.ok(Number.isFinite(event.venue.longitude));
    if (event.source?.canonicalUrl) assert.doesNotThrow(() => new URL(event.source.canonicalUrl));
  }
});
