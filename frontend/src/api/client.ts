import { Chain } from './zeus';

// we'll replace this with token going forward
const VITE_ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET as string;
const VITE_GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT as string;

const client = Chain(VITE_GRAPHQL_ENDPOINT, {
  headers: {
    'x-hasura-admin-secret': VITE_ADMIN_SECRET,
  },
});

export default client;
