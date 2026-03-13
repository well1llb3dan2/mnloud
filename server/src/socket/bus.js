let ioInstance = null;
let serverVersion = null;

export const setSocketServer = (io) => {
  ioInstance = io;
};

export const setServerVersion = (version) => {
  serverVersion = version;
};

export const getServerVersion = () => serverVersion;

export const emitToRoom = (room, event, payload) => {
  if (!ioInstance) return;
  ioInstance.to(room).emit(event, payload);
};

export const emitAll = (event, payload) => {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
};
