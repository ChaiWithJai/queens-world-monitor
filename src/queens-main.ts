import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/queens-monitor.css';
import calendarSnapshot from './queens/data/calendar-events.json';
import { neighborhoodAreas, neighborhoodCoverageSource } from './queens/data/neighborhoods';
import { people, stories } from './queens/data/stories';
import type { CalendarEvent, NeighborhoodArea, PersonProfile, QueensStory, WorldConnection } from './queens/types';

type Mode = 'stories' | 'people' | 'world' | 'events' | 'coverage';
type Selection = { kind: Mode; id: string; storyId?: string };
type WorldRecord = WorldConnection & { storyId: string; storyTitle: string; neighborhood: string };

const calendarEvents = calendarSnapshot as CalendarEvent[];
const currentTime = Date.now();
const upcomingEvents = calendarEvents.filter((event) => new Date(event.endDate).getTime() >= currentTime);
const worldRecords: WorldRecord[] = stories.flatMap((story) =>
  story.connections.map((connection) => ({ ...connection, storyId: story.id, storyTitle: story.title, neighborhood: story.neighborhood })),
);
const storiesByCoverageId = new Map<string, QueensStory[]>();
stories.forEach((story) => story.coverageAreaIds.forEach((areaId) => {
  storiesByCoverageId.set(areaId, [...(storiesByCoverageId.get(areaId) ?? []), story]);
}));
const coveredAreaIds = new Set(storiesByCoverageId.keys());

const required = <T extends Element>(selector: string): T => {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Queens World Monitor is missing ${selector}`);
  return node;
};

const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const normalize = (value: unknown) => String(value ?? '').toLocaleLowerCase();
const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

const eventSearchText = (event: CalendarEvent) => normalize([
  event.title, event.description, event.venue.name, event.venue.address, event.venue.neighborhood,
  ...(event.categories ?? []), ...(event.tags ?? []),
].join(' '));

const relatedEvents = (story: QueensStory) => {
  const neighborhood = normalize(story.neighborhood);
  const terms = story.eventTerms.map(normalize).filter((term) => term !== neighborhood);
  return upcomingEvents
    .map((event) => {
      const neighborhoodScore = normalize(event.venue.neighborhood) === neighborhood ? 2 : 0;
      const termScore = terms.filter((term) => eventSearchText(event).includes(term)).length;
      return { event, score: neighborhoodScore + termScore };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.event.startDate.localeCompare(right.event.startDate))
    .slice(0, 4)
    .map(({ event }) => event);
};

const personById = new Map(people.map((person) => [person.id, person]));
const storyById = new Map(stories.map((story) => [story.id, story]));
const eventById = new Map(calendarEvents.map((event) => [event.id, event]));

const searchInput = required<HTMLInputElement>('#queens-search');
const resultsNode = required<HTMLElement>('#search-results');
const resultLabel = required<HTMLElement>('#result-label');
const resultCount = required<HTMLElement>('#result-count');
const detailNode = required<HTMLElement>('#detail-content');
const detailPanel = required<HTMLElement>('#story-detail');
const detailLabel = required<HTMLElement>('#detail-label');
const traceWorldButton = required<HTMLButtonElement>('#trace-world');
const eventRibbon = required<HTMLElement>('#event-ribbon');

required('#story-count').textContent = String(stories.length);
required('#neighborhood-count').textContent = `${coveredAreaIds.size}/${neighborhoodAreas.length}`;
required('#people-count').textContent = String(people.length);
required('#connection-count').textContent = String(worldRecords.length);
required('#event-count').textContent = String(upcomingEvents.length);

let mode: Mode = 'stories';
const firstStory = stories[0];
if (!firstStory) throw new Error('Queens World Monitor requires at least one story');
let selection: Selection = { kind: 'stories', id: firstStory.id };

const map = new maplibregl.Map({
  container: 'queens-map',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: [-73.84, 40.73],
  zoom: 10.45,
  maxZoom: 19,
  attributionControl: false,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

const storyGeoJson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: stories.map((story) => ({
    type: 'Feature',
    id: story.id,
    geometry: { type: 'Point', coordinates: [story.longitude, story.latitude] },
    properties: { id: story.id, title: story.title, neighborhood: story.neighborhood, scale: story.scale },
  })),
};

const eventGeoJson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: upcomingEvents
    .filter((event) => Number.isFinite(event.venue.longitude) && Number.isFinite(event.venue.latitude))
    .map((event) => ({
      type: 'Feature',
      id: event.id,
      geometry: { type: 'Point', coordinates: [event.venue.longitude, event.venue.latitude] },
      properties: { id: event.id, title: event.title, neighborhood: event.venue.neighborhood },
    })),
};

const setConnectionMapData = (story?: QueensStory) => {
  if (!map.isStyleLoaded()) return;
  const connections = story?.connections ?? [];
  const points: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: connections.map((connection) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [connection.longitude, connection.latitude] },
      properties: { id: connection.id, place: connection.place, country: connection.country },
    })),
  };
  const lines: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: story ? connections.map((connection) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[story.longitude, story.latitude], [connection.longitude, connection.latitude]] },
      properties: { id: connection.id },
    })) : [],
  };
  (map.getSource('world-connections') as GeoJSONSource)?.setData(points);
  (map.getSource('connection-lines') as GeoJSONSource)?.setData(lines);
};

const selectStoryOnMap = (story: QueensStory, fly = true) => {
  setConnectionMapData(story);
  traceWorldButton.disabled = story.connections.length === 0;
  if (fly) map.flyTo({ center: [story.longitude, story.latitude], zoom: 14.2, duration: 1100 });
};

const addMapLayers = () => {
  map.addSource('queens-stories', { type: 'geojson', data: storyGeoJson });
  map.addSource('queens-events', { type: 'geojson', data: eventGeoJson });
  map.addSource('world-connections', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('connection-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  map.addLayer({ id: 'connection-lines', type: 'line', source: 'connection-lines', paint: { 'line-color': '#1558ff', 'line-width': 2, 'line-opacity': 0.68, 'line-dasharray': [2, 2] } });
  map.addLayer({ id: 'world-connections', type: 'circle', source: 'world-connections', paint: { 'circle-radius': 6, 'circle-color': '#c8ff4a', 'circle-stroke-color': '#081318', 'circle-stroke-width': 2 } });
  map.addLayer({ id: 'queens-events', type: 'circle', source: 'queens-events', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4, 15, 8], 'circle-color': '#ff6b53', 'circle-stroke-color': '#fffdf7', 'circle-stroke-width': 1.5, 'circle-opacity': 0.86 } });
  map.addLayer({ id: 'queens-stories', type: 'circle', source: 'queens-stories', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 7, 15, 12], 'circle-color': '#1558ff', 'circle-stroke-color': '#c8ff4a', 'circle-stroke-width': 3 } });

  (['queens-stories', 'queens-events', 'world-connections'] as const).forEach((layer) => {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  });

  map.on('click', 'queens-stories', (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (id && storyById.has(id)) setSelection({ kind: 'stories', id });
  });
  map.on('click', 'queens-events', (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (id && eventById.has(id)) setSelection({ kind: 'events', id });
  });
  map.on('click', 'world-connections', (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    const storyId = selection.kind === 'stories' ? selection.id : selection.storyId;
    const story = storyId ? storyById.get(storyId) : undefined;
    const connection = story?.connections.find((item) => item.id === id);
    if (connection) map.flyTo({ center: [connection.longitude, connection.latitude], zoom: 4, duration: 1200 });
  });

  const initial = storyById.get(selection.id);
  if (initial) selectStoryOnMap(initial, false);
};

map.on('load', addMapLayers);

const appendBadge = (parent: HTMLElement, text: string, className = '') => {
  const badge = create('span', `qm-badge ${className}`.trim(), text);
  parent.append(badge);
};

const appendSourceLinks = (parent: HTMLElement | DocumentFragment, story: QueensStory) => {
  const section = create('section', 'qm-detail-section');
  section.append(create('h3', '', 'Sources'));
  const list = create('div', 'qm-sources');
  story.sources.forEach((item) => {
    const link = create('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.append(create('strong', '', item.publisher), create('span', '', `${item.title} ↗`));
    list.append(link);
  });
  section.append(list);
  parent.append(section);
};

const renderStoryDetail = (story: QueensStory, focusPersonId?: string) => {
  detailLabel.textContent = 'SELECTED STORY';
  const fragment = document.createDocumentFragment();
  const meta = create('div', 'qm-detail-meta');
  appendBadge(meta, story.scale, story.scale.toLocaleLowerCase());
  story.themes.forEach((theme) => appendBadge(meta, theme));
  fragment.append(meta, create('h2', 'qm-detail-title', story.title), create('p', 'qm-detail-dek', story.dek));

  const address = create('div', 'qm-address');
  address.append(create('span', '', story.neighborhood), create('strong', '', story.streetAddress), create('small', '', story.years));
  fragment.append(address);

  const narrative = create('section', 'qm-detail-section');
  narrative.append(create('h3', '', 'Why this story travels'), create('p', '', story.story), create('blockquote', '', story.whyItTravels));
  fragment.append(narrative);

  if (story.personIds.length > 0) {
    const section = create('section', 'qm-detail-section');
    section.append(create('h3', '', 'People in this story'));
    const cards = create('div', 'qm-people-list');
    story.personIds.forEach((id) => {
      const person = personById.get(id);
      if (!person) return;
      const card = create('article', `qm-person-card ${focusPersonId === id ? 'is-focused' : ''}`.trim());
      const initials = person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('');
      card.append(create('span', 'qm-person-initials', initials));
      const copy = create('div');
      copy.append(create('strong', '', person.name), create('small', '', person.role), create('p', '', person.significance));
      card.append(copy);
      cards.append(card);
    });
    section.append(cards);
    fragment.append(section);
  }

  const connectionSection = create('section', 'qm-detail-section');
  connectionSection.append(create('h3', '', 'World connections'));
  const connectionList = create('div', 'qm-connections');
  story.connections.forEach((connection) => {
    const button = create('button');
    button.type = 'button';
    button.append(create('strong', '', `${connection.place} · ${connection.country}`), create('span', '', connection.relationship));
    button.addEventListener('click', () => map.flyTo({ center: [connection.longitude, connection.latitude], zoom: 4, duration: 1200 }));
    connectionList.append(button);
  });
  connectionSection.append(connectionList);
  fragment.append(connectionSection);

  const matchedEvents = relatedEvents(story);
  const eventSection = create('section', 'qm-detail-section');
  eventSection.append(create('h3', '', 'Related current events'));
  if (matchedEvents.length === 0) {
    eventSection.append(create('p', 'qm-empty', 'No close calendar match is live right now. The story stays mapped while the events change.'));
  } else {
    const list = create('div', 'qm-related-events');
    matchedEvents.forEach((event) => list.append(buildEventLink(event)));
    eventSection.append(list);
  }
  fragment.append(eventSection);
  appendSourceLinks(fragment, story);
  detailNode.replaceChildren(fragment);
};

const buildEventLink = (event: CalendarEvent) => {
  const link = create('a', 'qm-event-link');
  link.href = `https://queens-calendar.netlify.app/events/${event.slug}`;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.append(create('time', '', formatDate(event.startDate)), create('strong', '', event.title), create('span', '', `${event.venue.name} · ${event.venue.neighborhood}`));
  return link;
};

const renderEventDetail = (event: CalendarEvent) => {
  detailLabel.textContent = 'LIVE EVENT';
  const fragment = document.createDocumentFragment();
  const meta = create('div', 'qm-detail-meta');
  appendBadge(meta, 'LIVE EVENT', 'world');
  (event.categories ?? []).slice(0, 2).forEach((category) => appendBadge(meta, category));
  const address = create('div', 'qm-address');
  address.append(create('span', '', event.venue.neighborhood), create('strong', '', event.venue.address), create('small', '', formatDate(event.startDate)));
  const action = create('a', 'qm-primary-link', 'Open in Queens Calendar ↗');
  action.href = `https://queens-calendar.netlify.app/events/${event.slug}`;
  action.target = '_blank';
  action.rel = 'noreferrer';
  fragment.append(meta, create('h2', 'qm-detail-title', event.title), create('p', 'qm-detail-dek', event.description), address, action);
  if (event.source) {
    const sourceLink = create('a', 'qm-source-single', `Verify with ${event.source.name} ↗`);
    sourceLink.href = event.source.canonicalUrl;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noreferrer';
    fragment.append(sourceLink);
  }
  detailNode.replaceChildren(fragment);
};

const renderCoverageDetail = (area: NeighborhoodArea) => {
  detailLabel.textContent = 'COVERAGE STATUS';
  const fragment = document.createDocumentFragment();
  const meta = create('div', 'qm-detail-meta');
  appendBadge(meta, 'STORY NEEDED', 'usa');
  appendBadge(meta, area.id);
  const address = create('div', 'qm-address');
  address.append(
    create('span', '', 'QUEENS COVERAGE AREA'),
    create('strong', '', area.name),
    create('small', '', `${coveredAreaIds.size} OF ${neighborhoodAreas.length} AREAS COVERED`),
  );
  const standard = create('section', 'qm-detail-section');
  standard.append(
    create('h3', '', 'What completes this area'),
    create('p', '', 'Add a source-backed story tied to an exact street address, a recognizable person or event, and at least one connection to New York City, the United States, or the world.'),
  );
  const sourceSection = create('section', 'qm-detail-section');
  sourceSection.append(create('h3', '', 'Coverage baseline'));
  const sourceLink = create('a', 'qm-source-single', `${neighborhoodCoverageSource.publisher} · ${neighborhoodCoverageSource.title} ↗`);
  sourceLink.href = neighborhoodCoverageSource.url;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noreferrer';
  sourceSection.append(
    create('p', '', 'Neighborhood Tabulation Areas provide a consistent audit baseline. NYC Planning notes that their names and boundaries approximate neighborhoods and are not definitive or exhaustive.'),
    sourceLink,
  );
  fragment.append(
    meta,
    create('h2', 'qm-detail-title', `${area.name} needs its street-to-world story`),
    create('p', 'qm-detail-dek', 'This area is visible in the product backlog so borough-wide coverage can be measured rather than implied.'),
    address,
    standard,
    sourceSection,
  );
  detailNode.replaceChildren(fragment);
};

const buildResultButton = (title: string, eyebrow: string, summary: string, onSelect: () => void, active = false) => {
  const button = create('button', `qm-result ${active ? 'is-active' : ''}`.trim());
  button.type = 'button';
  button.append(create('span', '', eyebrow), create('strong', '', title), create('small', '', summary));
  button.addEventListener('click', onSelect);
  return button;
};

const currentRecords = () => {
  const query = normalize(searchInput.value.trim());
  if (mode === 'stories') return stories.filter((story) => normalize([story.title, story.dek, story.story, story.neighborhood, story.streetAddress, story.themes.join(' '), story.personIds.map((id) => personById.get(id)?.name).join(' ')].join(' ')).includes(query));
  if (mode === 'people') return people.filter((person) => normalize([person.name, person.role, person.significance, person.connections.join(' ')].join(' ')).includes(query));
  if (mode === 'world') return worldRecords.filter((record) => normalize([record.place, record.country, record.relationship, record.storyTitle, record.neighborhood].join(' ')).includes(query));
  if (mode === 'events') return upcomingEvents.filter((event) => eventSearchText(event).includes(query));
  return neighborhoodAreas.filter((area) => normalize([area.id, area.name, ...(storiesByCoverageId.get(area.id) ?? []).map((story) => `${story.title} ${story.streetAddress}`)].join(' ')).includes(query));
};

const renderResults = () => {
  const records = currentRecords();
  resultLabel.textContent = mode === 'world' ? 'WORLD TIES' : mode.toLocaleUpperCase();
  resultCount.textContent = `${records.length} ${records.length === 1 ? 'RESULT' : 'RESULTS'}`;
  const fragment = document.createDocumentFragment();
  records.forEach((record) => {
    if (mode === 'stories') {
      const story = record as QueensStory;
      fragment.append(buildResultButton(story.title, `${story.neighborhood} · ${story.scale}`, story.streetAddress, () => setSelection({ kind: 'stories', id: story.id }), selection.kind === 'stories' && selection.id === story.id));
    } else if (mode === 'people') {
      const person = record as PersonProfile;
      fragment.append(buildResultButton(person.name, person.role, person.significance, () => setSelection({ kind: 'people', id: person.id, storyId: person.storyIds[0] }), selection.kind === 'people' && selection.id === person.id));
    } else if (mode === 'world') {
      const connection = record as WorldRecord;
      fragment.append(buildResultButton(`${connection.place}, ${connection.country}`, connection.neighborhood, connection.relationship, () => setSelection({ kind: 'world', id: connection.id, storyId: connection.storyId }), selection.kind === 'world' && selection.id === connection.id));
    } else if (mode === 'events') {
      const event = record as CalendarEvent;
      fragment.append(buildResultButton(event.title, formatDate(event.startDate), `${event.venue.name} · ${event.venue.neighborhood}`, () => setSelection({ kind: 'events', id: event.id }), selection.kind === 'events' && selection.id === event.id));
    } else {
      const area = record as NeighborhoodArea;
      const story = storiesByCoverageId.get(area.id)?.[0];
      fragment.append(buildResultButton(
        area.name,
        story ? 'COVERED' : 'STORY NEEDED',
        story ? story.streetAddress : `${area.id} · street-level research open`,
        () => setSelection({ kind: 'coverage', id: area.id, storyId: story?.id }),
        selection.kind === 'coverage' && selection.id === area.id,
      ));
    }
  });
  if (records.length === 0) fragment.append(create('p', 'qm-empty', 'No match yet. Try a neighborhood, street, person, or broader theme.'));
  resultsNode.replaceChildren(fragment);
};

const setSelection = (next: Selection) => {
  selection = next;
  if (next.kind === 'events') {
    const event = eventById.get(next.id);
    if (event) {
      renderEventDetail(event);
      traceWorldButton.disabled = true;
      setConnectionMapData();
      map.flyTo({ center: [event.venue.longitude, event.venue.latitude], zoom: 14.2, duration: 1000 });
    }
  } else if (next.kind === 'coverage' && !next.storyId) {
    const area = neighborhoodAreas.find((item) => item.id === next.id);
    if (area) {
      renderCoverageDetail(area);
      traceWorldButton.disabled = true;
      setConnectionMapData();
      map.flyTo({ center: [-73.84, 40.73], zoom: 10.45, duration: 800 });
    }
  } else {
    const storyId = next.kind === 'stories' ? next.id : next.storyId;
    const story = storyId ? storyById.get(storyId) : undefined;
    if (story) {
      renderStoryDetail(story, next.kind === 'people' ? next.id : undefined);
      selectStoryOnMap(story);
    }
  }
  renderResults();
  if (window.matchMedia('(max-width: 760px)').matches) detailPanel.focus({ preventScroll: true });
};

document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode as Mode;
    document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((item) => item.setAttribute('aria-selected', String(item === button)));
    renderResults();
  });
});
searchInput.addEventListener('input', renderResults);
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
});

required<HTMLButtonElement>('#reset-queens').addEventListener('click', () => map.flyTo({ center: [-73.84, 40.73], zoom: 10.45, duration: 1000 }));
traceWorldButton.addEventListener('click', () => {
  const storyId = selection.kind === 'stories' ? selection.id : selection.storyId;
  const story = storyId ? storyById.get(storyId) : undefined;
  if (!story) return;
  const bounds = new maplibregl.LngLatBounds([story.longitude, story.latitude], [story.longitude, story.latitude]);
  story.connections.forEach((connection) => bounds.extend([connection.longitude, connection.latitude]));
  map.fitBounds(bounds, { padding: 70, maxZoom: 4, duration: 1300 });
});

const renderEventRibbon = () => {
  const fragment = document.createDocumentFragment();
  upcomingEvents.slice(0, 12).forEach((event) => fragment.append(buildEventLink(event)));
  if (upcomingEvents.length === 0) fragment.append(create('p', 'qm-empty', 'The next Queens Calendar sync will add upcoming events here.'));
  eventRibbon.replaceChildren(fragment);
};

renderResults();
renderEventRibbon();
renderStoryDetail(firstStory);
