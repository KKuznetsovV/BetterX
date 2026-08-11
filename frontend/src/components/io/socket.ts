import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_IO_SERVER_URL);
export default socket;
