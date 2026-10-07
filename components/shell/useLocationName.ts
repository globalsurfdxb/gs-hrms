import { useOrg } from '@/context/OrgContext';

/** Resolve a location id (e.g. "Dubai") to its display name (e.g. "United Arab Emirates"). */
export function useLocationName() {
  const { locationName } = useOrg();
  return locationName;
}
