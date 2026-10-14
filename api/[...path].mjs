import { server } from '../server.mjs';

export default function handler(request, response) {
  server.emit('request', request, response);
}
