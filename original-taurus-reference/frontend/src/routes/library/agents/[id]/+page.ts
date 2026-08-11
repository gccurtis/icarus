import type { PageLoad } from './$types';

// The personality sub-route: the id is the whole payload. Resolution (and the
// unknown-id fallback to Activity) lives in AgentsConsole, beside the data.
export const load: PageLoad = ({ params }) => ({ personaId: params.id });
