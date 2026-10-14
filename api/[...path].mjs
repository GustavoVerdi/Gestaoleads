import { Server } from 'node:http';

const listen = Server.prototype.listen;
Server.prototype.listen = function () { return this; };
const { server } = await import('../server.mjs');
Server.prototype.listen = listen;

export default function handler(request, response) {
  server.emit('request', request, response);
}
