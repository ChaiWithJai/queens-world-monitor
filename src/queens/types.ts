export type StoryScale = 'NYC' | 'USA' | 'WORLD';
export type StoryTheme = 'arts' | 'civic' | 'diplomacy' | 'innovation' | 'migration' | 'music' | 'sport';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SourceLink {
  title: string;
  publisher: string;
  url: string;
  kind: 'official' | 'institutional' | 'reference';
}

export interface WorldConnection extends Coordinates {
  id: string;
  place: string;
  country: string;
  relationship: string;
}

export interface PersonProfile {
  id: string;
  name: string;
  role: string;
  significance: string;
  storyIds: string[];
  connections: string[];
  source: SourceLink;
}

export interface NeighborhoodArea {
  id: string;
  name: string;
}

export interface QueensStory extends Coordinates {
  id: string;
  title: string;
  dek: string;
  story: string;
  whyItTravels: string;
  neighborhood: string;
  coverageAreaIds: string[];
  streetAddress: string;
  years: string;
  scale: StoryScale;
  themes: StoryTheme[];
  personIds: string[];
  connections: WorldConnection[];
  eventTerms: string[];
  sources: SourceLink[];
}

export interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  registrationUrl: string;
  categories: string[];
  tags: string[];
  venue: {
    name: string;
    address: string;
    neighborhood: string;
    latitude: number;
    longitude: number;
  };
  source?: {
    name: string;
    canonicalUrl: string;
  };
}
