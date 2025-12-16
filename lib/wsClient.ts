// WebSocket disconnected - System relies on Polling
export default {
  connect: () => {},
  subscribe: (callback: any) => {
    // No-op subscription
    return () => {}; // No-op unsubscribe
  },
  disconnect: () => {},
};
