import { query } from "$app/server";

import { username as usernameProcedure } from "$capabilities/development/api/username/username";

export const username = query(usernameProcedure);
