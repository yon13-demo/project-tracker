// Lets any function (even inside child components) trigger the popup without
// prop-drilling, the same way window.alert() could be called from anywhere.
let alertSetter: ((message: string) => void) | null = null;
let statusSetter: ((message: string | null) => void) | null = null;

export function showAlert(message: string) {
  if (alertSetter) alertSetter(message);
  else if (typeof window !== 'undefined') window.alert(message);
}

export function showStatus(message: string) {
  if (statusSetter) statusSetter(message);
}

export function registerNotifiers(alert: (message: string) => void, status: (message: string | null) => void) {
  alertSetter = alert;
  statusSetter = status;
  return () => { alertSetter = null; statusSetter = null; };
}
