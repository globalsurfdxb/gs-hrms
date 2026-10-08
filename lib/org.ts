/* One place for the organisation's name, so every screen, footer and export says the same thing. */

/** The group name used in headings, footers and descriptions. */
export const ENTITY_NAME = 'Global Surf IT';

/** Registered legal entity per work location (the id of a LocationDef). */
export const LEGAL_ENTITIES: Record<string, string> = {
  Dubai: 'Global Surf IT LLC',
  Kochi: 'Global Surf IT Pvt Ltd',
};

/** Legal name for a location; falls back to the group name for any other site. */
export const legalEntityFor = (location: string) => LEGAL_ENTITIES[location] ?? ENTITY_NAME;

/** Primary website shown on the organisation overview. */
export const ENTITY_WEBSITE = 'www.gs-it.ae';
